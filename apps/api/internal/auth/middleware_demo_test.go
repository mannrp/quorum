package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/local/quorum/apps/api/internal/demo"
)

func TestDemoHeaderIgnoredWhenDemoModeDisabled(t *testing.T) {
	middleware := NewMiddleware(nil, nil, false)
	seenUser := false
	handler := middleware.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, seenUser = UserFromContext(r.Context())
		w.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodPost, "/graphql", nil)
	request.Header.Set(demo.HeaderPersona, "student")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if seenUser {
		t.Fatal("demo user was injected with demo mode disabled")
	}
}

func TestInvalidDemoPersonaRejectedWhenDemoModeEnabled(t *testing.T) {
	middleware := NewMiddleware(nil, nil, true)
	handler := middleware.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called for invalid demo persona")
	}))

	request := httptest.NewRequest(http.MethodPost, "/graphql", nil)
	request.Header.Set(demo.HeaderPersona, "not-a-persona")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}
