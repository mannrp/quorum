package server

import (
	"fmt"
	"net"
	"os"
	"path/filepath"

	"github.com/local/quorum/apps/api/internal/config"
)

// Listen opens the API's private listener. A configured socket is preferred in
// production so Next is the only container that needs a network-facing port.
func Listen(cfg config.Config) (net.Listener, error) {
	if cfg.InternalSocketPath == "" {
		return net.Listen("tcp", ":"+cfg.Port)
	}

	directory := filepath.Dir(cfg.InternalSocketPath)
	info, err := os.Stat(directory)
	if err != nil {
		return nil, fmt.Errorf("internal socket directory: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("internal socket directory is not a directory")
	}

	if existing, err := os.Lstat(cfg.InternalSocketPath); err == nil {
		if existing.Mode()&os.ModeSocket == 0 {
			return nil, fmt.Errorf("internal socket path exists and is not a socket")
		}
		if err := os.Remove(cfg.InternalSocketPath); err != nil {
			return nil, fmt.Errorf("remove stale internal socket: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("inspect internal socket path: %w", err)
	}

	listener, err := net.Listen("unix", cfg.InternalSocketPath)
	if err != nil {
		return nil, fmt.Errorf("internal socket listener: %w", err)
	}
	if err := os.Chmod(cfg.InternalSocketPath, 0o660); err != nil {
		_ = listener.Close()
		return nil, fmt.Errorf("internal socket permissions: %w", err)
	}
	return listener, nil
}
