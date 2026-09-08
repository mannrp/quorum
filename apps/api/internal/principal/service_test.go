package principal

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/identity"
)

type fakeViewerReader struct {
	row ViewerRow
	err error
}

func (f fakeViewerReader) GetViewer(context.Context, string, string) (ViewerRow, error) {
	return f.row, f.err
}

type fakeProvisioner struct {
	input identity.ProvisionInput
	err   error
}

func (f *fakeProvisioner) Provision(_ context.Context, input identity.ProvisionInput) (identity.ProvisionResult, error) {
	f.input = input
	return identity.ProvisionResult{UserID: "user-1", Created: true}, f.err
}

func TestViewerProjectsOnlyCurrentActiveSelfServiceState(t *testing.T) {
	service := NewService(fakeViewerReader{row: ViewerRow{
		ProductUserID:    "user-1",
		AccountState:     "ACTIVE",
		SyncStatus:       "CURRENT",
		OnboardingState:  "NOT_STARTED",
		Username:         nil,
		DisplayName:      nil,
		SelfServiceRoles: []string{"STUDENT"},
	}}, &fakeProvisioner{})

	viewer, err := service.Viewer(context.Background(), "primary", "auth-user-1")
	if err != nil {
		t.Fatal(err)
	}
	if viewer.ProductUserID != "user-1" || len(viewer.SelfServiceRoles) != 1 || viewer.SelfServiceRoles[0] != "STUDENT" {
		t.Fatalf("unexpected viewer projection: %#v", viewer)
	}
}

func TestViewerFailsClosedForMissingStaleInactiveOrInvalidRole(t *testing.T) {
	tests := []struct {
		name string
		row  ViewerRow
		err  error
		want error
	}{
		{name: "missing", err: pgx.ErrNoRows, want: ErrUnknownIdentity},
		{name: "stale", row: ViewerRow{AccountState: "ACTIVE", SyncStatus: "STALE"}, want: ErrUnavailableIdentity},
		{name: "suspended", row: ViewerRow{AccountState: "SUSPENDED", SyncStatus: "CURRENT"}, want: ErrInactiveAccount},
		{name: "admin leakage", row: ViewerRow{AccountState: "ACTIVE", SyncStatus: "CURRENT", SelfServiceRoles: []string{"ADMIN"}}, want: ErrInvalidProjection},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service := NewService(fakeViewerReader{row: test.row, err: test.err}, &fakeProvisioner{})
			_, err := service.Viewer(context.Background(), "primary", "auth-user-1")
			if !errors.Is(err, test.want) {
				t.Fatalf("got %v, want %v", err, test.want)
			}
		})
	}
}

func TestEnrollAllowsOnlyStudentOrSponsorAndUsesAssertionIdentity(t *testing.T) {
	provisioner := &fakeProvisioner{}
	service := NewService(fakeViewerReader{row: ViewerRow{
		ProductUserID: "user-1", AccountState: "ACTIVE", SyncStatus: "CURRENT",
		OnboardingState: "NOT_STARTED", SelfServiceRoles: []string{"SPONSOR"},
	}}, provisioner)

	_, err := service.Enroll(context.Background(), EnrollmentInput{
		Realm: "primary", Subject: "auth-user-1", VerifiedEmail: "user@example.test", Role: "SPONSOR",
	})
	if err != nil {
		t.Fatal(err)
	}
	if provisioner.input.IdentitySubject != "auth-user-1" || provisioner.input.EnrollmentRole != identity.RoleSponsor {
		t.Fatalf("unexpected provision input: %#v", provisioner.input)
	}

	_, err = service.Enroll(context.Background(), EnrollmentInput{
		Realm: "primary", Subject: "auth-user-1", VerifiedEmail: "user@example.test", Role: "ADMIN",
	})
	if !errors.Is(err, ErrInvalidEnrollment) {
		t.Fatalf("got %v, want invalid enrollment", err)
	}
}
