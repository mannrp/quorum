package storage

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/local/quorum/apps/api/internal/config"
)

func TestPresignPostBuildsResumeUpload(t *testing.T) {
	signer := NewR2Signer(config.Config{
		R2AccountID:       "account",
		R2AccessKeyID:     "access",
		R2SecretAccessKey: "secret",
		R2BucketName:      "bucket",
		R2PublicURL:       "https://assets.example",
	})
	signer.now = func() time.Time { return time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC) }

	post, err := signer.PresignPost(context.Background(), AssetResume, "user-1", "Resume Final.pdf", "application/pdf", 1024)
	if err != nil {
		t.Fatalf("PresignPost returned error: %v", err)
	}
	if post.URL != "https://account.r2.cloudflarestorage.com/bucket" {
		t.Fatalf("url = %q", post.URL)
	}
	if !strings.HasPrefix(post.Key, "resumes/user-1/") {
		t.Fatalf("key = %q", post.Key)
	}
	if post.PublicURL == "" {
		t.Fatal("public URL was empty")
	}
	for _, name := range []string{"key", "policy", "x-amz-signature", "x-amz-credential"} {
		if post.Fields[name] == "" {
			t.Fatalf("missing field %s", name)
		}
	}
}

func TestPresignPostRejectsInvalidTypeAndSize(t *testing.T) {
	signer := NewR2Signer(config.Config{R2AccountID: "account", R2AccessKeyID: "access", R2SecretAccessKey: "secret", R2BucketName: "bucket"})
	if _, err := signer.PresignPost(context.Background(), AssetResume, "user-1", "resume.exe", "application/octet-stream", 100); err == nil {
		t.Fatal("expected invalid content type error")
	}
	if _, err := signer.PresignPost(context.Background(), AssetResume, "user-1", "resume.pdf", "application/pdf", 11*1024*1024); err == nil {
		t.Fatal("expected invalid size error")
	}
}
