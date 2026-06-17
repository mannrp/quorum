package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/demo"
)

type Middleware struct {
	queries  *db.Queries
	verifier *Verifier
	demoMode bool
}

func NewMiddleware(queries *db.Queries, verifier *Verifier, demoMode bool) *Middleware {
	return &Middleware{queries: queries, verifier: verifier, demoMode: demoMode}
}

func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if m.demoMode {
			persona := strings.TrimSpace(r.Header.Get(demo.HeaderPersona))
			if persona != "" {
				authID, ok := demo.AuthIDForPersona(persona)
				if !ok {
					http.Error(w, "invalid demo persona", http.StatusUnauthorized)
					return
				}
				user, err := m.queries.GetUserByAuthID(r.Context(), authID)
				if err != nil {
					http.Error(w, "demo persona is not seeded", http.StatusUnauthorized)
					return
				}
				ctx := WithSubject(r.Context(), authID)
				next.ServeHTTP(w, r.WithContext(WithUser(ctx, user)))
				return
			}
		}

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
