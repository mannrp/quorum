package internalapi

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

type ActorKind string

const (
	ActorAuthenticated       ActorKind = "AUTHENTICATED"
	ActorAnonymous           ActorKind = "ANONYMOUS"
	ContractVersion                    = "quorum-internal-v1"
	DefaultAssertionLifetime           = 15 * time.Second
	MaximumAssertionLifetime           = 60 * time.Second
	maximumVerificationKeys            = 8
)

type Assertion struct {
	Version               string    `json:"typ"`
	Issuer                string    `json:"iss"`
	Audience              string    `json:"aud"`
	IssuedAt              int64     `json:"iat"`
	NotBefore             int64     `json:"nbf"`
	ExpiresAt             int64     `json:"exp"`
	ID                    string    `json:"jti"`
	ActorKind             ActorKind `json:"actor_kind"`
	IdentityRealm         string    `json:"identity_realm,omitempty"`
	Subject               string    `json:"sub,omitempty"`
	AuthenticatedAt       int64     `json:"authenticated_at,omitempty"`
	AuthenticationMethods []string  `json:"amr,omitempty"`
	Assurance             string    `json:"assurance,omitempty"`
	DeviceHandle          string    `json:"device_handle,omitempty"`
	CorrelationID         string    `json:"correlation_id"`
}

type VerifierConfig struct {
	Issuer    string
	Audience  string
	Type      string
	Keys      map[string]ed25519.PublicKey
	Now       func() time.Time
	ClockSkew time.Duration
}

type Verifier struct{ config VerifierConfig }

func NewVerifier(config VerifierConfig) (*Verifier, error) {
	if strings.TrimSpace(config.Issuer) == "" || strings.TrimSpace(config.Audience) == "" || strings.TrimSpace(config.Type) == "" {
		return nil, errors.New("issuer, audience, and type are required")
	}
	if len(config.Keys) == 0 || len(config.Keys) > maximumVerificationKeys {
		return nil, fmt.Errorf("verification key count must be between 1 and %d", maximumVerificationKeys)
	}
	copied := make(map[string]ed25519.PublicKey, len(config.Keys))
	for kid, key := range config.Keys {
		if strings.TrimSpace(kid) == "" || len(key) != ed25519.PublicKeySize {
			return nil, errors.New("each verification key requires a valid kid and Ed25519 public key")
		}
		copied[kid] = append(ed25519.PublicKey(nil), key...)
	}
	config.Keys = copied
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.ClockSkew < 0 || config.ClockSkew > 5*time.Second {
		return nil, errors.New("clock skew must be between zero and five seconds")
	}
	return &Verifier{config: config}, nil
}

func (v *Verifier) Verify(ctx context.Context, encoded string) (Assertion, error) {
	if err := ctx.Err(); err != nil {
		return Assertion{}, err
	}
	token, err := jwt.ParseSigned(encoded, []jose.SignatureAlgorithm{jose.EdDSA})
	if err != nil {
		return Assertion{}, errors.New("malformed internal assertion")
	}
	if len(token.Headers) != 1 {
		return Assertion{}, errors.New("internal assertion must have one signature")
	}
	header := token.Headers[0]
	if header.Algorithm != string(jose.EdDSA) {
		return Assertion{}, errors.New("internal assertion algorithm rejected")
	}
	headerType, ok := header.ExtraHeaders[jose.HeaderType].(string)
	if !ok || headerType != v.config.Type {
		return Assertion{}, errors.New("internal assertion type rejected")
	}
	key, ok := v.config.Keys[header.KeyID]
	if !ok {
		return Assertion{}, errors.New("internal assertion key rejected")
	}

	var assertion Assertion
	var raw map[string]json.RawMessage
	if err := token.Claims(key, &assertion, &raw); err != nil {
		return Assertion{}, errors.New("internal assertion signature rejected")
	}
	if err := v.validate(assertion, raw); err != nil {
		return Assertion{}, err
	}
	return assertion, nil
}

func (v *Verifier) validate(a Assertion, raw map[string]json.RawMessage) error {
	for _, forbidden := range []string{"role", "roles", "permission", "permissions", "approval", "email", "owner", "profile_complete"} {
		if _, exists := raw[forbidden]; exists {
			return fmt.Errorf("authorization claim %q is forbidden", forbidden)
		}
	}
	if a.Version != ContractVersion || a.Issuer != v.config.Issuer || a.Audience != v.config.Audience {
		return errors.New("internal assertion target rejected")
	}
	if a.ID == "" || a.CorrelationID == "" || a.IssuedAt == 0 || a.NotBefore == 0 || a.ExpiresAt == 0 {
		return errors.New("internal assertion missing required claim")
	}
	lifetime := time.Duration(a.ExpiresAt-a.IssuedAt) * time.Second
	if lifetime <= 0 || lifetime > MaximumAssertionLifetime {
		return errors.New("internal assertion lifetime rejected")
	}
	now := v.config.Now()
	if now.Add(v.config.ClockSkew).Before(time.Unix(a.NotBefore, 0)) || now.Add(v.config.ClockSkew).Before(time.Unix(a.IssuedAt, 0)) {
		return errors.New("internal assertion not active")
	}
	if !now.Add(-v.config.ClockSkew).Before(time.Unix(a.ExpiresAt, 0)) {
		return errors.New("internal assertion expired")
	}
	switch a.ActorKind {
	case ActorAuthenticated:
		if a.IdentityRealm == "" || a.Subject == "" || a.AuthenticatedAt == 0 || len(a.AuthenticationMethods) == 0 || a.Assurance == "" || a.DeviceHandle == "" {
			return errors.New("authenticated assertion claim set rejected")
		}
	case ActorAnonymous:
		if a.IdentityRealm != "" || a.Subject != "" || a.AuthenticatedAt != 0 || len(a.AuthenticationMethods) != 0 || a.Assurance != "" || a.DeviceHandle != "" {
			return errors.New("anonymous assertion claim set rejected")
		}
	default:
		return errors.New("internal assertion actor kind rejected")
	}
	return nil
}
