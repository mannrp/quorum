package server

import (
	"net"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/local/quorum/apps/api/internal/config"
)

func TestListenReplacesOnlyAStaleUnixSocket(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix socket lifecycle is verified on Ubuntu CI")
	}

	path := filepath.Join(t.TempDir(), "api.sock")
	stale, err := net.Listen("unix", path)
	if err != nil {
		t.Fatal(err)
	}
	stale.(*net.UnixListener).SetUnlinkOnClose(false)
	if err := stale.Close(); err != nil {
		t.Fatal(err)
	}

	listener, err := Listen(config.Config{InternalSocketPath: path})
	if err != nil {
		t.Fatalf("Listen() with stale socket: %v", err)
	}
	_ = listener.Close()

	regularPath := filepath.Join(t.TempDir(), "not-a-socket")
	if err := os.WriteFile(regularPath, []byte("do not remove"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Listen(config.Config{InternalSocketPath: regularPath}); err == nil {
		t.Fatal("Listen() replaced a non-socket file")
	}
}
