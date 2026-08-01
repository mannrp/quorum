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
	R2AccountID               string
	R2AccessKeyID             string
	R2SecretAccessKey         string
	R2BucketName              string
	R2PublicURL               string
	Port                      string
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
		R2AccountID:               os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:             os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey:         os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2BucketName:              os.Getenv("R2_BUCKET_NAME"),
		R2PublicURL:               strings.TrimRight(os.Getenv("R2_PUBLIC_URL"), "/"),
		Port:                      env("PORT", "8080"),
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
	if c.AppEnv != "development" {
		if len(c.InternalAssertionKeys) == 0 {
			missing = append(missing, "INTERNAL_ASSERTION_PUBLIC_KEYS")
		}
		for key, value := range map[string]string{
			"R2_ACCOUNT_ID":        c.R2AccountID,
			"R2_ACCESS_KEY_ID":     c.R2AccessKeyID,
			"R2_SECRET_ACCESS_KEY": c.R2SecretAccessKey,
			"R2_BUCKET_NAME":       c.R2BucketName,
		} {
			if strings.TrimSpace(value) == "" {
				missing = append(missing, key)
			}
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing required config: %s", strings.Join(missing, ", "))
	}
	if strings.TrimSpace(c.Port) == "" {
		return errors.New("PORT is required")
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
