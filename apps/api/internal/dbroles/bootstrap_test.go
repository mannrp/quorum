package dbroles

import "testing"

func TestConfigValidateRequiresEveryCredential(t *testing.T) {
	valid := Config{
		OperatorURL:         "postgres://operator:secret@localhost:5432/quorum_dev",
		MigratorPassword:    "migrator-secret",
		AuthRuntimePassword: "auth-secret",
		AppRuntimePassword:  "app-secret",
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}

	tests := map[string]func(*Config){
		"operator URL":      func(c *Config) { c.OperatorURL = "" },
		"migrator password": func(c *Config) { c.MigratorPassword = "" },
		"auth password":     func(c *Config) { c.AuthRuntimePassword = "" },
		"app password":      func(c *Config) { c.AppRuntimePassword = "" },
	}
	for name, mutate := range tests {
		t.Run(name, func(t *testing.T) {
			candidate := valid
			mutate(&candidate)
			if err := candidate.Validate(); err == nil {
				t.Fatal("expected incomplete config to fail")
			}
		})
	}
}
