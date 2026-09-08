package config

import (
	"bufio"
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	AppEnv                    string
	DatabaseURL               string
	Port                      string
	InternalSocketPath        string
	InternalAssertionIssuer   string
	InternalAssertionAudience string
	InternalAssertionKeys     map[string]ed25519.PublicKey
}

func Load() (Config, error) {
	if err := loadEnv(".env"); err != nil && !os.IsNotExist(err) {
		return Config{}, err
	}
	if err := loadEnv(filepath.Join("apps", "api", ".env")); err != nil && !os.IsNotExist(err) {
		return Config{}, err
	}

	assertionKeys, err := assertionPublicKeys(os.Getenv("INTERNAL_ASSERTION_PUBLIC_KEYS"))
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		AppEnv:                    env("APP_ENV", "development"),
		DatabaseURL:               os.Getenv("DATABASE_URL"),
		Port:                      env("PORT", "8080"),
		InternalSocketPath:        strings.TrimSpace(os.Getenv("INTERNAL_API_SOCKET_PATH")),
		InternalAssertionIssuer:   env("INTERNAL_ASSERTION_ISSUER", "quorum-next"),
		InternalAssertionAudience: env("INTERNAL_ASSERTION_AUDIENCE", "quorum-go"),
		InternalAssertionKeys:     assertionKeys,
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error {
	var missing []string
	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if c.AppEnv != "development" && len(c.InternalAssertionKeys) == 0 {
		missing = append(missing, "INTERNAL_ASSERTION_PUBLIC_KEYS")
	}
	if c.AppEnv == "production" && c.InternalSocketPath == "" {
		missing = append(missing, "INTERNAL_API_SOCKET_PATH")
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s", strings.Join(missing, ", "))
	}
	if strings.TrimSpace(c.Port) == "" && c.InternalSocketPath == "" {
		return errors.New("PORT or INTERNAL_API_SOCKET_PATH is required")
	}
	return nil
}
func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func loadEnv(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key != "" && os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
	return scanner.Err()
}
func assertionPublicKeys(raw string) (map[string]ed25519.PublicKey, error) {
	keys := map[string]ed25519.PublicKey{}
	if strings.TrimSpace(raw) == "" {
		return keys, nil
	}
	for _, entry := range strings.Split(raw, ",") {
		kid, encoded, ok := strings.Cut(strings.TrimSpace(entry), ":")
		if !ok || strings.TrimSpace(kid) != kid || kid == "" || encoded == "" {
			return nil, errors.New("INTERNAL_ASSERTION_PUBLIC_KEYS must contain kid:base64url entries")
		}
		decoded, err := base64.RawURLEncoding.DecodeString(encoded)
		if err != nil || len(decoded) != ed25519.PublicKeySize {
			return nil, errors.New("INTERNAL_ASSERTION_PUBLIC_KEYS contains an invalid Ed25519 public key")
		}
		if _, exists := keys[kid]; exists {
			return nil, errors.New("INTERNAL_ASSERTION_PUBLIC_KEYS contains a duplicate kid")
		}
		keys[kid] = ed25519.PublicKey(decoded)
	}
	if len(keys) > 8 {
		return nil, errors.New("INTERNAL_ASSERTION_PUBLIC_KEYS exceeds the eight-key limit")
	}
	return keys, nil
}
