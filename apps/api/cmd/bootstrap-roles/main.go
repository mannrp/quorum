package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/dbroles"
)

func main() {
	config := dbroles.Config{
		OperatorURL:         os.Getenv("OPERATOR_DATABASE_URL"),
		MigratorPassword:    os.Getenv("QUORUM_MIGRATOR_PASSWORD"),
		AuthRuntimePassword: os.Getenv("QUORUM_AUTH_RUNTIME_PASSWORD"),
		AppRuntimePassword:  os.Getenv("QUORUM_APP_RUNTIME_PASSWORD"),
	}
	if err := config.Validate(); err != nil {
		fatal(err)
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, config.OperatorURL)
	if err != nil {
		fatal(fmt.Errorf("connect as database operator: %w", err))
	}
	defer conn.Close(ctx)
	if err := dbroles.Bootstrap(ctx, conn, config); err != nil {
		fatal(err)
	}
	fmt.Println("database roles bootstrapped and public CREATE revoked")
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "bootstrap-roles:", err)
	os.Exit(1)
}
