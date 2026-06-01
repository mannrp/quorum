package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Verifier struct {
	audience string
	issuer   string
	jwksURL  string

	client  *http.Client
	expires time.Time
	keys    map[string]*rsa.PublicKey
	mu      sync.Mutex
}

func NewVerifier(issuer, jwksURL, audience string) *Verifier {
	return &Verifier{
		audience: audience,
		issuer:   issuer,
		jwksURL:  jwksURL,
		client:   &http.Client{Timeout: 5 * time.Second},
		keys:     map[string]*rsa.PublicKey{},
	}
}

func (v *Verifier) Verify(ctx context.Context, token string) (string, error) {
	if v.issuer == "" || v.jwksURL == "" {
		return "", errors.New("neon auth issuer and jwks url are required")
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", errors.New("token must have three parts")
	}

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
		Typ string `json:"typ"`
	}
	if err := decodeJSON(parts[0], &header); err != nil {
		return "", err
	}
	if header.Alg != "RS256" || header.Kid == "" {
		return "", errors.New("unsupported token header")
	}

	key, err := v.key(ctx, header.Kid)
	if err != nil {
		return "", err
	}

	signingInput := parts[0] + "." + parts[1]
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(signingInput))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], signature); err != nil {
		return "", err
	}

	var claims map[string]any
	if err := decodeJSON(parts[1], &claims); err != nil {
		return "", err
	}
	return v.validateClaims(claims)
}

func (v *Verifier) validateClaims(claims map[string]any) (string, error) {
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("missing sub claim")
	}
	iss, _ := claims["iss"].(string)
	if iss != v.issuer {
		return "", errors.New("issuer mismatch")
	}
	if v.audience != "" && !claimHasAudience(claims["aud"], v.audience) {
		return "", errors.New("audience mismatch")
	}

	now := time.Now()
	if exp, ok := numericClaim(claims["exp"]); ok && now.After(time.Unix(exp, 0)) {
		return "", errors.New("token expired")
	}
	if nbf, ok := numericClaim(claims["nbf"]); ok && now.Before(time.Unix(nbf, 0).Add(-30*time.Second)) {
		return "", errors.New("token not valid yet")
	}
	return sub, nil
}

func (v *Verifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	if key, ok := v.keys[kid]; ok && time.Now().Before(v.expires) {
		return key, nil
	}
	if err := v.refresh(ctx); err != nil {
		return nil, err
	}
	key, ok := v.keys[kid]
	if !ok {
		return nil, errors.New("jwks key not found")
	}
	return key, nil
}

func (v *Verifier) refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("jwks returned %d", resp.StatusCode)
	}

	var payload struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return err
	}

	keys := map[string]*rsa.PublicKey{}
	for _, jwk := range payload.Keys {
		if jwk.Kty != "RSA" || jwk.Kid == "" || jwk.N == "" || jwk.E == "" {
			continue
		}
		n, err := base64.RawURLEncoding.DecodeString(jwk.N)
		if err != nil {
			return err
		}
		e, err := base64.RawURLEncoding.DecodeString(jwk.E)
		if err != nil {
			return err
		}
		exponent := 0
		for _, b := range e {
			exponent = exponent<<8 + int(b)
		}
		keys[jwk.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: exponent}
	}
	v.keys = keys
	v.expires = time.Now().Add(5 * time.Minute)
	return nil
}

func decodeJSON(part string, target any) error {
	bytes, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		return err
	}
	return json.Unmarshal(bytes, target)
}

func claimHasAudience(value any, audience string) bool {
	switch aud := value.(type) {
	case string:
		return aud == audience
	case []any:
		for _, item := range aud {
			if text, ok := item.(string); ok && text == audience {
				return true
			}
		}
	}
	return false
}

func numericClaim(value any) (int64, bool) {
	switch n := value.(type) {
	case float64:
		return int64(n), true
	case json.Number:
		i, err := n.Int64()
		return i, err == nil
	default:
		return 0, false
	}
}
