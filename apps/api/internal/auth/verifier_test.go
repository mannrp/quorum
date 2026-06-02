package auth

import (
	"context"
	"crypto"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestVerifierAcceptsValidToken(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"kty": "RSA",
				"kid": "test-key",
				"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.PublicKey.E)).Bytes()),
			}},
		})
	}))
	defer jwks.Close()

	token := signTestToken(t, privateKey, map[string]any{
		"sub": "neon-user-1",
		"iss": "https://issuer.example",
		"aud": "quorum",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	sub, err := NewVerifier("https://issuer.example", jwks.URL, "quorum").Verify(context.Background(), token)
	if err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
	if sub != "neon-user-1" {
		t.Fatalf("subject = %q, want neon-user-1", sub)
	}
}

func TestVerifierRejectsWrongIssuer(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"kty": "RSA",
				"kid": "test-key",
				"n":   base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.PublicKey.E)).Bytes()),
			}},
		})
	}))
	defer jwks.Close()

	token := signTestToken(t, privateKey, map[string]any{
		"sub": "neon-user-1",
		"iss": "https://wrong.example",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	if _, err := NewVerifier("https://issuer.example", jwks.URL, "").Verify(context.Background(), token); err == nil {
		t.Fatal("Verify succeeded with wrong issuer")
	}
}

func TestVerifierAcceptsValidEdDSAToken(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"alg": "EdDSA",
				"crv": "Ed25519",
				"kty": "OKP",
				"kid": "ed-test-key",
				"x":   base64.RawURLEncoding.EncodeToString(publicKey),
			}},
		})
	}))
	defer jwks.Close()

	token := signEdDSATestToken(t, privateKey, map[string]any{
		"sub": "neon-user-2",
		"iss": "https://issuer.example",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	sub, err := NewVerifier("https://issuer.example", jwks.URL, "").Verify(context.Background(), token)
	if err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
	if sub != "neon-user-2" {
		t.Fatalf("subject = %q, want neon-user-2", sub)
	}
}

func TestVerifierRejectsAlgorithmMismatch(t *testing.T) {
	publicKey, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"alg": "EdDSA",
				"crv": "Ed25519",
				"kty": "OKP",
				"kid": "test-key",
				"x":   base64.RawURLEncoding.EncodeToString(publicKey),
			}},
		})
	}))
	defer jwks.Close()

	token := signTestToken(t, privateKey, map[string]any{
		"sub": "neon-user-1",
		"iss": "https://issuer.example",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	if _, err := NewVerifier("https://issuer.example", jwks.URL, "").Verify(context.Background(), token); err == nil {
		t.Fatal("Verify succeeded with an algorithm/key mismatch")
	}
}

func signTestToken(t *testing.T, key *rsa.PrivateKey, claims map[string]any) string {
	t.Helper()
	header := map[string]string{"alg": "RS256", "kid": "test-key", "typ": "JWT"}
	headerBytes, err := json.Marshal(header)
	if err != nil {
		t.Fatal(err)
	}
	claimBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	signingInput := base64.RawURLEncoding.EncodeToString(headerBytes) + "." + base64.RawURLEncoding.EncodeToString(claimBytes)
	hash := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		t.Fatal(err)
	}
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature)
}

func signEdDSATestToken(t *testing.T, key ed25519.PrivateKey, claims map[string]any) string {
	t.Helper()
	header := map[string]string{"alg": "EdDSA", "kid": "ed-test-key", "typ": "JWT"}
	headerBytes, err := json.Marshal(header)
	if err != nil {
		t.Fatal(err)
	}
	claimBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	signingInput := base64.RawURLEncoding.EncodeToString(headerBytes) + "." + base64.RawURLEncoding.EncodeToString(claimBytes)
	signature := ed25519.Sign(key, []byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature)
}
