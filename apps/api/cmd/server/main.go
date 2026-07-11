package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/config"
	"github.com/local/quorum/apps/api/internal/server"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx := context.Background()
	cfg, err := config.Load()
	if err != nil {
		logger.Error("config load failed", "error", err)
		os.Exit(1)
	}

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database pool failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := bootstrapAdmins(ctx, pool, cfg.AdminEmails); err != nil {
		logger.Error("admin bootstrap failed", "error", err)
		os.Exit(1)
	}

	httpServer := server.NewHTTPServer(cfg, server.NewHandler(cfg, pool, logger))

	errs := make(chan error, 1)
	go func() {
		logger.Info("api listening", "addr", "http://localhost:"+cfg.Port)
		errs <- httpServer.ListenAndServe()
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	select {
	case sig := <-stop:
		logger.Info("shutdown signal received", "signal", sig.String())
	case err := <-errs:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("api stopped")
}

func bootstrapAdmins(ctx context.Context, pool *pgxpool.Pool, emails []string) error {
	if len(emails) == 0 {
		return nil
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO admin_users (user_id)
		SELECT id
		FROM users
		WHERE lower(email) = ANY($1::text[])
		ON CONFLICT DO NOTHING
	`, emails)
	return err
}
