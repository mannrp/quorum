package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/db"
)

type Middleware struct {
	queries  *db.Queries
	verifier *Verifier
}

func NewMiddleware(queries *db.Queries, verifier *Verifier) *Middleware {
	return &Middleware{queries: queries, verifier: verifier}
}

func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if header == "" {
			next.ServeHTTP(w, r)
			return
		}

		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || strings.TrimSpace(token) == "" {
			http.Error(w, "invalid authorization header", http.StatusUnauthorized)
			return
		}

		sub, err := m.verifier.Verify(r.Context(), strings.TrimSpace(token))
		if err != nil {
			http.Error(w, "invalid bearer token", http.StatusUnauthorized)
			return
		}

		ctx := WithSubject(r.Context(), sub)
		user, err := m.queries.GetUserByAuthID(ctx, sub)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			http.Error(w, "auth lookup failed", http.StatusInternalServerError)
			return
		}

		next.ServeHTTP(w, r.WithContext(WithUser(ctx, user)))
	})
}
