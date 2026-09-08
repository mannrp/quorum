package principal

import (
	"context"
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/local/quorum/apps/api/internal/internalapi"
)

type assertionVerifier interface {
	Verify(context.Context, string) (internalapi.Assertion, error)
}

type principalService interface {
	Enroll(context.Context, EnrollmentInput) (Viewer, error)
	Viewer(context.Context, string, string) (Viewer, error)
}

type HTTPHandler struct {
	verifier assertionVerifier
	service  principalService
}

func NewHTTPHandler(verifier assertionVerifier, service principalService) http.Handler {
	handler := &HTTPHandler{verifier: verifier, service: service}
	mux := http.NewServeMux()
	mux.HandleFunc("/internal/v1/enrollment", handler.enrollment)
	mux.HandleFunc("/internal/v1/viewer", handler.viewer)
	return mux
}

func (h *HTTPHandler) assertion(r *http.Request) (internalapi.Assertion, bool) {
	token := strings.TrimSpace(r.Header.Get("X-Quorum-Assertion"))
	if token == "" {
		return internalapi.Assertion{}, false
	}
	assertion, err := h.verifier.Verify(r.Context(), token)
	if err != nil || assertion.ActorKind != internalapi.ActorAuthenticated {
		return internalapi.Assertion{}, false
	}
	if correlation := strings.TrimSpace(r.Header.Get("X-Correlation-ID")); correlation == "" || correlation != assertion.CorrelationID {
		return internalapi.Assertion{}, false
	}
	return assertion, true
}

func (h *HTTPHandler) enrollment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	assertion, ok := h.assertion(r)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		w.WriteHeader(http.StatusUnsupportedMediaType)
		return
	}
	var input struct {
		Role          string
		VerifiedEmail string
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	viewer, err := h.service.Enroll(ctx, EnrollmentInput{
		Realm:         assertion.IdentityRealm,
		Subject:       assertion.Subject,
		VerifiedEmail: input.VerifiedEmail,
		Role:          input.Role,
	})
	if err != nil {
		writePrincipalError(w, err)
		return
	}
	writeViewer(w, viewer)
}

func (h *HTTPHandler) viewer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	assertion, ok := h.assertion(r)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	viewer, err := h.service.Viewer(ctx, assertion.IdentityRealm, assertion.Subject)
	if err != nil {
		writePrincipalError(w, err)
		return
	}
	writeViewer(w, viewer)
}

func writePrincipalError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnknownIdentity):
		w.WriteHeader(http.StatusNotFound)
	case errors.Is(err, ErrInactiveAccount), errors.Is(err, ErrUnavailableIdentity):
		w.WriteHeader(http.StatusForbidden)
	case errors.Is(err, ErrInvalidEnrollment), errors.Is(err, ErrInvalidProjection):
		w.WriteHeader(http.StatusBadRequest)
	default:
		w.WriteHeader(http.StatusInternalServerError)
	}
}

func writeViewer(w http.ResponseWriter, viewer Viewer) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, no-store")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"viewer": map[string]any{
			"productUserId":    viewer.ProductUserID,
			"accountState":     viewer.AccountState,
			"onboardingState":  viewer.OnboardingState,
			"username":         viewer.Username,
			"displayName":      viewer.DisplayName,
			"selfServiceRoles": viewer.SelfServiceRoles,
		},
	})
}
