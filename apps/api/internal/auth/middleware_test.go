package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/internalapi"
	"github.com/local/quorum/apps/api/internal/principal"
)

type middlewareVerifier struct {
	assertion internalapi.Assertion
	err       error
}

func (f middlewareVerifier) Verify(context.Context, string) (internalapi.Assertion, error) {
	return f.assertion, f.err
}

type middlewarePrincipals struct {
	viewer principal.Viewer
	err    error
}

func (f middlewarePrincipals) Viewer(context.Context, string, string) (principal.Viewer, error) {
	return f.viewer, f.err
}

type middlewareUsers struct {
	user db.User
}

func (f middlewareUsers) GetUser(context.Context, pgtype.UUID) (db.User, error) {
	return f.user, nil
}

func TestMiddlewareResolvesAssertionThroughCurrentPrincipal(t *testing.T) {
	var id pgtype.UUID
	if err := id.Scan("11111111-1111-1111-1111-111111111111"); err != nil {
		t.Fatal(err)
	}
	middleware := NewMiddleware(
		middlewareUsers{user: db.User{ID: id}},
		middlewareVerifier{assertion: internalapi.Assertion{ActorKind: internalapi.ActorAuthenticated, IdentityRealm: "primary", Subject: "auth-user-1"}},
		middlewarePrincipals{viewer: principal.Viewer{ProductUserID: "11111111-1111-1111-1111-111111111111", AccountState: "ACTIVE"}},
	)
	handler := middleware.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := UserFromContext(r.Context()); !ok {
			t.Fatal("resolved user missing")
		}
		if subject, ok := SubjectFromContext(r.Context()); !ok || subject != "auth-user-1" {
			t.Fatal("assertion subject missing")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodPost, "/graphql", nil)
	request.Header.Set("X-Quorum-Assertion", "signed")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestMiddlewareAllowsAnonymousAndRejectsInvalidOrUnavailableAssertions(t *testing.T) {
	anonymous := NewMiddleware(middlewareUsers{}, nil, nil).Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	response := httptest.NewRecorder()
	anonymous.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/graphql", nil))
	if response.Code != http.StatusNoContent {
		t.Fatalf("anonymous status = %d", response.Code)
	}

	for _, middleware := range []*Middleware{
		NewMiddleware(middlewareUsers{}, middlewareVerifier{err: errors.New("invalid")}, middlewarePrincipals{}),
		NewMiddleware(middlewareUsers{}, middlewareVerifier{assertion: internalapi.Assertion{ActorKind: internalapi.ActorAuthenticated}}, middlewarePrincipals{err: principal.ErrInactiveAccount}),
	} {
		request := httptest.NewRequest(http.MethodPost, "/graphql", nil)
		request.Header.Set("X-Quorum-Assertion", "signed")
		response := httptest.NewRecorder()
		middleware.Wrap(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Fatal("invalid assertion reached handler")
		})).ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d", response.Code)
		}
	}
}
