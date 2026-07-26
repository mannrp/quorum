package localdb

import "testing"

func TestValidateResetTarget(t *testing.T) {
	tests := []struct {
		name    string
		rawURL  string
		allowed bool
	}{
		{"loopback dev", "postgres://user:pass@127.0.0.1:54322/quorum_dev?sslmode=disable", true},
		{"localhost test", "postgres://user:pass@localhost:54322/quorum_test?sslmode=disable", true},
		{"compose dev", "postgres://user:pass@postgres:5432/quorum_dev?sslmode=disable", true},
		{"remote host", "postgres://user:pass@db.example.com:5432/quorum_dev?sslmode=require", false},
		{"provider host", "postgres://user:pass@abc.supabase.co:5432/quorum_test?sslmode=require", false},
		{"wrong database", "postgres://user:pass@127.0.0.1:54322/quorum?sslmode=disable", false},
		{"missing database", "postgres://user:pass@127.0.0.1:54322/?sslmode=disable", false},
		{"invalid URL", "not a database URL", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateResetTarget(tt.rawURL)
			if tt.allowed && err != nil {
				t.Fatalf("expected allowed target: %v", err)
			}
			if !tt.allowed && err == nil {
				t.Fatal("expected target rejection")
			}
		})
	}
}

func TestValidateMarker(t *testing.T) {
	if err := ValidateMarker("same", "same"); err != nil {
		t.Fatalf("expected matching marker: %v", err)
	}
	for _, pair := range [][2]string{{"", "same"}, {"same", ""}, {"one", "two"}} {
		if err := ValidateMarker(pair[0], pair[1]); err == nil {
			t.Fatalf("expected marker rejection for %#v", pair)
		}
	}
}
