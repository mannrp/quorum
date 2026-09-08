package server

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestGraphQLErrorPresenterMasksDatabaseDetails(t *testing.T) {
	present := graphQLErrorPresenter(slog.Default())
	err := &pgconn.PgError{Code: "23505", Message: "duplicate key", Detail: "secret@example.test"}

	if got := present(context.Background(), err).Message; got != "request could not be completed" {
		t.Fatalf("presented error = %q, want masked message", got)
	}
}

func TestGraphQLErrorPresenterKeepsDomainErrors(t *testing.T) {
	present := graphQLErrorPresenter(slog.Default())

	if got := present(context.Background(), errors.New("team lead access required")).Message; got != "team lead access required" {
		t.Fatalf("presented error = %q, want reviewed domain message", got)
	}
}
