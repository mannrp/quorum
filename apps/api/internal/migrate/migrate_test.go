package migrate

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDiscoverRejectsMissingAndEmptyDirectories(t *testing.T) {
	if _, err := Discover(filepath.Join(t.TempDir(), "missing")); err == nil {
		t.Fatal("expected missing migration directory to fail")
	}

	empty := t.TempDir()
	if _, err := Discover(empty); err == nil {
		t.Fatal("expected empty migration directory to fail")
	}
}

func TestDiscoverOrdersVersionsAndComputesChecksums(t *testing.T) {
	dir := t.TempDir()
	writeMigration(t, dir, "000002_second.sql", "select 2;")
	writeMigration(t, dir, "000001_first.sql", "select 1;")

	migrations, err := Discover(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(migrations), 2; got != want {
		t.Fatalf("got %d migrations, want %d", got, want)
	}
	if migrations[0].Version != "000001" || migrations[1].Version != "000002" {
		t.Fatalf("unexpected order: %q, %q", migrations[0].Version, migrations[1].Version)
	}
	if migrations[0].Checksum == "" || migrations[0].Checksum == migrations[1].Checksum {
		t.Fatal("expected distinct nonempty checksums")
	}
}

func TestDiscoverRejectsDuplicateAndMalformedVersions(t *testing.T) {
	for name, files := range map[string][]string{
		"duplicate": {"000001_first.sql", "000001_second.sql"},
		"malformed": {"initial.sql"},
	} {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			for _, file := range files {
				writeMigration(t, dir, file, "select 1;")
			}
			if _, err := Discover(dir); err == nil {
				t.Fatal("expected discovery to fail")
			}
		})
	}
}

func TestVerifyAppliedChecksumRejectsMutation(t *testing.T) {
	migration := Migration{Version: "000001", Name: "000001_first.sql", Checksum: "new"}
	if err := verifyAppliedChecksum(migration, "old"); err == nil {
		t.Fatal("expected a changed applied migration to fail")
	}
	if err := verifyAppliedChecksum(migration, "new"); err != nil {
		t.Fatalf("expected matching checksum to pass: %v", err)
	}
	if err := verifyAppliedChecksum(migration, ""); err == nil {
		t.Fatal("expected a legacy row without a checksum to fail closed")
	}
}

func writeMigration(t *testing.T, dir, name, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
}
