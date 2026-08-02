package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/internalapi"
	"github.com/local/quorum/apps/api/internal/principal"
)

type assertionVerifier interface {
	Verify(context.Context, string) (internalapi.Assertion, error)
}

type principalResolver interface {
	Viewer(context.Context, string, string) (principal.Viewer, error)
}

type userReader interface {
	GetUser(context.Context, pgtype.UUID) (db.User, error)
}

type Middleware struct {
	users      userReader
	verifier   assertionVerifier
	principals principalResolver
}

func NewMiddleware(users userReader, verifier assertionVerifier, principals principalResolver) *Middleware {
	return &Middleware{users: users, verifier: verifier, principals: principals}
}

func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimSpace(r.Header.Get("X-Quorum-Assertion"))
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		if m.verifier == nil || m.principals == nil {
			http.Error(w, "invalid internal assertion", http.StatusUnauthorized)
			return
		}
		assertion, err := m.verifier.Verify(r.Context(), token)
		if err != nil {
			http.Error(w, "invalid internal assertion", http.StatusUnauthorized)
			return
		}
		if assertion.ActorKind == internalapi.ActorAnonymous {
			next.ServeHTTP(w, r)
			return
		}
		if assertion.ActorKind != internalapi.ActorAuthenticated {
			http.Error(w, "invalid internal assertion", http.StatusUnauthorized)
			return
		}
		viewer, err := m.principals.Viewer(r.Context(), assertion.IdentityRealm, assertion.Subject)
		if err != nil {
			if errors.Is(err, principal.ErrUnknownIdentity) || errors.Is(err, principal.ErrInactiveAccount) || errors.Is(err, principal.ErrUnavailableIdentity) {
				http.Error(w, "principal unavailable", http.StatusUnauthorized)
				return
			}
			http.Error(w, "principal lookup failed", http.StatusInternalServerError)
			return
		}
		var userID pgtype.UUID
		if err := userID.Scan(viewer.ProductUserID); err != nil {
			http.Error(w, "principal lookup failed", http.StatusInternalServerError)
			return
		}
		user, err := m.users.GetUser(r.Context(), userID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				http.Error(w, "principal unavailable", http.StatusUnauthorized)
				return
			}
			http.Error(w, "principal lookup failed", http.StatusInternalServerError)
			return
		}
		ctx := WithRoles(WithSubject(r.Context(), assertion.Subject), viewer.SelfServiceRoles)
		next.ServeHTTP(w, r.WithContext(WithUser(ctx, user)))
	})
}
