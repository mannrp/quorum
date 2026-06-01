package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/local/quorum/apps/api/internal/config"
)

type AssetKind string

const (
	AssetResume      AssetKind = "RESUME"
	AssetProjectFile AssetKind = "PROJECT_FILE"
	AssetAvatar      AssetKind = "AVATAR"
	AssetVideo       AssetKind = "VIDEO"
)

type PresignedPost struct {
	URL       string
	Key       string
	PublicURL string
	ExpiresAt time.Time
	Fields    map[string]string
}

type R2Signer struct {
	accountID string
	accessKey string
	secretKey string
	bucket    string
	publicURL string
	now       func() time.Time
}

func NewR2Signer(cfg config.Config) *R2Signer {
	return &R2Signer{
		accountID: strings.TrimSpace(cfg.R2AccountID),
		accessKey: strings.TrimSpace(cfg.R2AccessKeyID),
		secretKey: strings.TrimSpace(cfg.R2SecretAccessKey),
		bucket:    strings.TrimSpace(cfg.R2BucketName),
		publicURL: strings.TrimRight(strings.TrimSpace(cfg.R2PublicURL), "/"),
		now:       time.Now,
	}
}

func (s *R2Signer) Enabled() bool {
	return s.accountID != "" && s.accessKey != "" && s.secretKey != "" && s.bucket != ""
}

func (s *R2Signer) PresignPost(_ context.Context, kind AssetKind, userID, filename, contentType string, size int64) (PresignedPost, error) {
	if !s.Enabled() {
		return PresignedPost{}, errors.New("r2 signing is not configured")
	}
	rule, err := ruleFor(kind)
	if err != nil {
		return PresignedPost{}, err
	}
	if size <= 0 || size > rule.maxBytes {
		return PresignedPost{}, fmt.Errorf("%s uploads must be between 1 byte and %d bytes", strings.ToLower(string(kind)), rule.maxBytes)
	}
	if !rule.contentTypes[contentType] {
		return PresignedPost{}, fmt.Errorf("content type %q is not allowed for %s uploads", contentType, strings.ToLower(string(kind)))
	}

	now := s.now().UTC()
	expires := now.Add(15 * time.Minute)
	key := path.Join(rule.prefix, cleanSegment(userID), fmt.Sprintf("%d-%s", now.UnixNano(), cleanFilename(filename)))
	credentialDate := now.Format("20060102")
	credentialScope := credentialDate + "/auto/s3/aws4_request"
	credential := s.accessKey + "/" + credentialScope

	policy := map[string]any{
		"expiration": expires.Format(time.RFC3339),
		"conditions": []any{
			map[string]string{"bucket": s.bucket},
			map[string]string{"key": key},
			map[string]string{"Content-Type": contentType},
			map[string]string{"x-amz-algorithm": "AWS4-HMAC-SHA256"},
			map[string]string{"x-amz-credential": credential},
			map[string]string{"x-amz-date": now.Format("20060102T150405Z")},
			[]any{"content-length-range", 1, rule.maxBytes},
		},
	}
	policyBytes, err := json.Marshal(policy)
	if err != nil {
		return PresignedPost{}, err
	}
	encodedPolicy := base64.StdEncoding.EncodeToString(policyBytes)
	signature := sign(encodedPolicy, s.secretKey, credentialDate)

	url := fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s", s.accountID, s.bucket)
	publicURL := ""
	if s.publicURL != "" {
		publicURL = s.publicURL + "/" + key
	}
	return PresignedPost{
		URL:       url,
		Key:       key,
		PublicURL: publicURL,
		ExpiresAt: expires,
		Fields: map[string]string{
			"key":              key,
			"Content-Type":     contentType,
			"bucket":           s.bucket,
			"policy":           encodedPolicy,
			"x-amz-algorithm":  "AWS4-HMAC-SHA256",
			"x-amz-credential": credential,
			"x-amz-date":       now.Format("20060102T150405Z"),
			"x-amz-signature":  signature,
		},
	}, nil
}

type uploadRule struct {
	prefix       string
	maxBytes     int64
	contentTypes map[string]bool
}

func ruleFor(kind AssetKind) (uploadRule, error) {
	switch kind {
	case AssetResume:
		return uploadRule{prefix: "resumes", maxBytes: 10 * 1024 * 1024, contentTypes: allowed("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}, nil
	case AssetProjectFile:
		return uploadRule{prefix: "project-files", maxBytes: 50 * 1024 * 1024, contentTypes: allowed("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed")}, nil
	case AssetAvatar:
		return uploadRule{prefix: "avatars", maxBytes: 5 * 1024 * 1024, contentTypes: allowed("image/jpeg", "image/png", "image/webp")}, nil
	case AssetVideo:
		return uploadRule{prefix: "videos", maxBytes: 200 * 1024 * 1024, contentTypes: allowed("video/mp4", "video/webm", "video/quicktime")}, nil
	default:
		return uploadRule{}, fmt.Errorf("unknown upload asset kind %q", kind)
	}
}

func allowed(types ...string) map[string]bool {
	out := make(map[string]bool, len(types))
	for _, typ := range types {
		out[typ] = true
	}
	return out
}

var safeSegment = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func cleanSegment(value string) string {
	cleaned := strings.Trim(safeSegment.ReplaceAllString(value, "-"), ".-")
	if cleaned == "" {
		return "unknown"
	}
	return cleaned
}

func cleanFilename(value string) string {
	base := path.Base(strings.ReplaceAll(value, "\\", "/"))
	return cleanSegment(base)
}

func sign(policy, secret, date string) string {
	dateKey := hmacSHA256([]byte("AWS4"+secret), date)
	regionKey := hmacSHA256(dateKey, "auto")
	serviceKey := hmacSHA256(regionKey, "s3")
	signingKey := hmacSHA256(serviceKey, "aws4_request")
	signature := hmacSHA256(signingKey, policy)
	return hex.EncodeToString(signature)
}

func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(value))
	return mac.Sum(nil)
}
