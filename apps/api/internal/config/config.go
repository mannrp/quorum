package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	AppEnv            string
	AppOrigin         string
	DatabaseURL       string
	NeonAuthIssuer    string
	NeonAuthJWKSURL   string
	NeonAuthAudience  string
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2BucketName      string
	R2PublicURL       string
	Port              string
	DemoModeEnabled   bool
	DemoResetEnabled  bool
}

func Load() (Config, error) {
	if err := loadEnv(".env"); err != nil && !os.IsNotExist(err) {
		return Config{}, err
	}
	if err := loadEnv(filepath.Join("apps", "api", ".env")); err != nil && !os.IsNotExist(err) {
		return Config{}, err
	}

	cfg := Config{
		AppEnv:            env("APP_ENV", "development"),
		AppOrigin:         env("APP_ORIGIN", "http://localhost:3000"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		NeonAuthIssuer:    os.Getenv("NEON_AUTH_ISSUER"),
		NeonAuthJWKSURL:   os.Getenv("NEON_AUTH_JWKS_URL"),
		NeonAuthAudience:  os.Getenv("NEON_AUTH_AUDIENCE"),
		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2BucketName:      os.Getenv("R2_BUCKET_NAME"),
		R2PublicURL:       strings.TrimRight(os.Getenv("R2_PUBLIC_URL"), "/"),
		Port:              env("PORT", "8080"),
		DemoModeEnabled:   boolEnv("ENABLE_DEMO_MODE"),
		DemoResetEnabled:  boolEnv("DEMO_RESET_ENABLED"),
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
		for key, value := range map[string]string{
			"NEON_AUTH_ISSUER":     c.NeonAuthIssuer,
			"NEON_AUTH_JWKS_URL":   c.NeonAuthJWKSURL,
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

func boolEnv(key string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
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
