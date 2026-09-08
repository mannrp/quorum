package principal

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/local/quorum/apps/api/internal/internalapi"
)

type fakeAssertionVerifier struct {
	assertion internalapi.Assertion
	err       error
	token     string
}

func (f *fakeAssertionVerifier) Verify(_ context.Context, token string) (internalapi.Assertion, error) {
	f.token = token
	return f.assertion, f.err
}

type fakePrincipalService struct {
	enrollment    EnrollmentInput
	viewerRealm   string
	viewerSubject string
	result        Viewer
}

func (f *fakePrincipalService) Enroll(_ context.Context, input EnrollmentInput) (Viewer, error) {
	f.enrollment = input
	return f.result, nil
}

func (f *fakePrincipalService) Viewer(_ context.Context, realm, subject string) (Viewer, error) {
	f.viewerRealm, f.viewerSubject = realm, subject
	return f.result, nil
}

func authenticatedAssertion() internalapi.Assertion {
	return internalapi.Assertion{
		ActorKind:     internalapi.ActorAuthenticated,
		IdentityRealm: "primary",
		Subject:       "auth-user-1",
		CorrelationID: "corr-1",
	}
}

func TestEnrollmentUsesVerifiedAssertionIdentityAndAllowlistedRole(t *testing.T) {
	verifier := &fakeAssertionVerifier{assertion: authenticatedAssertion()}
	service := &fakePrincipalService{result: Viewer{ProductUserID: "product-1", AccountState: "ACTIVE", OnboardingState: "NOT_STARTED", SelfServiceRoles: []string{"STUDENT"}}}
	handler := NewHTTPHandler(verifier, service)

	request := httptest.NewRequest(http.MethodPost, "/internal/v1/enrollment", strings.NewReader(`{"role":"STUDENT","verifiedEmail":"user@example.test"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Quorum-Assertion", "signed")
	request.Header.Set("X-Correlation-ID", "corr-1")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", response.Code, response.Body.String())
	}
	if service.enrollment.Realm != "primary" || service.enrollment.Subject != "auth-user-1" || service.enrollment.Role != "STUDENT" {
		t.Fatalf("browser identity reached service: %#v", service.enrollment)
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if _, exists := body["email"]; exists {
		t.Fatal("viewer response exposed email")
	}
}

func TestPrivateEndpointsFailClosedForMissingAssertionSpoofAndWrongActor(t *testing.T) {
	tests := []struct {
		name        string
		assertion   internalapi.Assertion
		verifierErr error
		body        string
		want        int
	}{
		{name: "missing", assertion: authenticatedAssertion(), want: http.StatusUnauthorized},
		{name: "invalid signature", verifierErr: errors.New("invalid"), want: http.StatusUnauthorized},
		{name: "anonymous", assertion: internalapi.Assertion{ActorKind: internalapi.ActorAnonymous, CorrelationID: "corr-1"}, want: http.StatusUnauthorized},
		{name: "spoofed identity field", assertion: authenticatedAssertion(), body: `{"role":"STUDENT","verifiedEmail":"user@example.test","subject":"attacker"}`, want: http.StatusBadRequest},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			verifier := &fakeAssertionVerifier{assertion: test.assertion, err: test.verifierErr}
			service := &fakePrincipalService{}
			handler := NewHTTPHandler(verifier, service)
			body := test.body
			if body == "" {
				body = `{"role":"STUDENT","verifiedEmail":"user@example.test"}`
			}
			request := httptest.NewRequest(http.MethodPost, "/internal/v1/enrollment", strings.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Correlation-ID", "corr-1")
			if test.name != "missing" {
				request.Header.Set("X-Quorum-Assertion", "signed")
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.want {
				t.Fatalf("status = %d, want %d", response.Code, test.want)
			}
		})
	}
}

func TestViewerUsesAssertionAndReturnsExactProjection(t *testing.T) {
	verifier := &fakeAssertionVerifier{assertion: authenticatedAssertion()}
	service := &fakePrincipalService{result: Viewer{ProductUserID: "product-1", AccountState: "ACTIVE", OnboardingState: "COMPLETE", SelfServiceRoles: []string{"SPONSOR"}}}
	handler := NewHTTPHandler(verifier, service)
	request := httptest.NewRequest(http.MethodGet, "/internal/v1/viewer", nil)
	request.Header.Set("X-Quorum-Assertion", "signed")
	request.Header.Set("X-Correlation-ID", "corr-1")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	if service.viewerRealm != "primary" || service.viewerSubject != "auth-user-1" {
		t.Fatalf("viewer identity mismatch: %s/%s", service.viewerRealm, service.viewerSubject)
	}
	if got := response.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}
}
