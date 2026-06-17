package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/demo"
)

func main() {
	reset := flag.Bool("reset", false, "delete reserved demo fixture records before seeding")
	flag.Parse()

	if err := loadEnv(".env"); err != nil && !os.IsNotExist(err) {
		panic(err)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		panic("DATABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	if err := demo.Seed(ctx, pool, *reset); err != nil {
		panic(err)
	}
	if *reset {
		fmt.Println("demo fixtures reset and seeded")
		return
	}
	fmt.Println("demo fixtures seeded")
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
