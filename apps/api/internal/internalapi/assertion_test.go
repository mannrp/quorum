package internalapi

import (
    "context"
    "crypto/ed25519"
    "crypto/rand"
    "encoding/base64"
    "encoding/json"
    "strings"
    "testing"
    "time"
)

func TestVerifierEnforcesAuthenticatedAssertionContract(t *testing.T) {
    publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
    if err != nil { t.Fatal(err) }
    now := time.Unix(1_800_000_000, 0)
    verifier, err := NewVerifier(VerifierConfig{
        Issuer: "quorum-next", Audience: "quorum-go", Type: "quorum-internal+jwt",
        Keys: map[string]ed25519.PublicKey{"active": publicKey}, Now: func() time.Time { return now },
    })
    if err != nil { t.Fatal(err) }
    claims := map[string]any{
        "typ":"quorum-internal-v1", "iss":"quorum-next", "aud":"quorum-go",
        "iat":now.Unix(), "nbf":now.Add(-time.Second).Unix(), "exp":now.Add(15*time.Second).Unix(),
        "jti":"jti-1", "actor_kind":"AUTHENTICATED", "identity_realm":"primary",
        "sub":"better-auth-user-1", "authenticated_at":now.Add(-time.Minute).Unix(),
        "amr":[]string{"pwd"}, "assurance":"AAL1", "device_handle":"device-1", "correlation_id":"corr-1",
    }
    assertion, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "active", "quorum-internal+jwt", claims))
    if err != nil { t.Fatalf("Verify() error = %v", err) }
    if assertion.Subject != "better-auth-user-1" || assertion.ActorKind != ActorAuthenticated { t.Fatalf("unexpected assertion: %#v", assertion) }

    forbidden := cloneClaims(claims); forbidden["role"] = "ADMIN"
    if _, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "active", "quorum-internal+jwt", forbidden)); err == nil {
        t.Fatal("Verify accepted an authorization claim")
    }
    overlong := cloneClaims(claims); overlong["exp"] = now.Add(61*time.Second).Unix()
    if _, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "active", "quorum-internal+jwt", overlong)); err == nil {
        t.Fatal("Verify accepted an assertion longer than 60 seconds")
    }
}

func TestVerifierEnforcesAnonymousClaimSeparationAndHeaders(t *testing.T) {
    publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
    if err != nil { t.Fatal(err) }
    now := time.Unix(1_800_000_000, 0)
    verifier, err := NewVerifier(VerifierConfig{Issuer:"quorum-next", Audience:"quorum-go", Type:"quorum-internal+jwt", Keys:map[string]ed25519.PublicKey{"active":publicKey}, Now:func() time.Time{return now}})
    if err != nil { t.Fatal(err) }
    claims := map[string]any{"typ":"quorum-internal-v1","iss":"quorum-next","aud":"quorum-go","iat":now.Unix(),"nbf":now.Unix(),"exp":now.Add(15*time.Second).Unix(),"jti":"jti-anon","actor_kind":"ANONYMOUS","correlation_id":"corr-anon"}
    if _, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "active", "quorum-internal+jwt", claims)); err != nil { t.Fatalf("anonymous Verify() error = %v", err) }
    confused := cloneClaims(claims); confused["sub"] = "fabricated"
    if _, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "active", "quorum-internal+jwt", confused)); err == nil { t.Fatal("anonymous assertion accepted sub") }
    if _, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "unknown", "quorum-internal+jwt", claims)); err == nil { t.Fatal("unknown kid accepted") }
    if _, err := verifier.Verify(context.Background(), signEdDSA(t, privateKey, "active", "JWT", claims)); err == nil { t.Fatal("wrong JOSE typ accepted") }
}

func signEdDSA(t *testing.T, key ed25519.PrivateKey, kid, typ string, claims map[string]any) string {
    t.Helper(); header, _ := json.Marshal(map[string]string{"alg":"EdDSA","kid":kid,"typ":typ}); payload, _ := json.Marshal(claims)
    input := base64.RawURLEncoding.EncodeToString(header)+"."+base64.RawURLEncoding.EncodeToString(payload)
    return input+"."+base64.RawURLEncoding.EncodeToString(ed25519.Sign(key, []byte(input)))
}
func cloneClaims(source map[string]any) map[string]any { target:=map[string]any{}; for k,v:=range source { target[k]=v }; return target }
func TestAssertionNeverSerializesAuthority(t *testing.T) { raw,_:=json.Marshal(Assertion{}); for _,name:=range []string{"role","permission","email","approval"} { if strings.Contains(string(raw),name) { t.Fatalf("Assertion serialized forbidden authority %q: %s",name,raw) } } }