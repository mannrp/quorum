package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	quorummigrate "github.com/local/quorum/apps/api/internal/migrate"
)

func main() {
	ctx := context.Background()

	if err := loadEnv(".env"); err != nil && !os.IsNotExist(err) {
		panic(err)
	}

	databaseURL := os.Getenv("MIGRATOR_DATABASE_URL")
	if databaseURL == "" {
		panic("MIGRATOR_DATABASE_URL is required")
	}

	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		panic(err)
	}
	defer conn.Close(ctx)

	migrations, err := quorummigrate.Discover("migrations")
	if err != nil {
		panic(err)
	}
	if err := quorummigrate.Apply(ctx, conn, migrations); err != nil {
		panic(err)
	}
	fmt.Printf("migration ledger verified; %d canonical migrations present\n", len(migrations))
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
