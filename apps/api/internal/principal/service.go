package principal

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/local/quorum/apps/api/internal/identity"
)

var (
	ErrUnknownIdentity     = errors.New("unknown identity")
	ErrUnavailableIdentity = errors.New("identity unavailable")
	ErrInactiveAccount     = errors.New("account inactive")
	ErrInvalidProjection   = errors.New("invalid viewer projection")
	ErrInvalidEnrollment   = errors.New("invalid self-service enrollment")
)

type ViewerRow struct {
	ProductUserID    string
	AccountState     string
	SyncStatus       string
	OnboardingState  string
	Username         *string
	DisplayName      *string
	SelfServiceRoles []string
}

type Viewer struct {
	ProductUserID    string
	AccountState     string
	OnboardingState  string
	Username         *string
	DisplayName      *string
	SelfServiceRoles []string
}

type EnrollmentInput struct {
	Realm         string
	Subject       string
	VerifiedEmail string
	Role          string
}

type viewerReader interface {
	GetViewer(context.Context, string, string) (ViewerRow, error)
}

type provisioner interface {
	Provision(context.Context, identity.ProvisionInput) (identity.ProvisionResult, error)
}

type Service struct {
	viewers     viewerReader
	provisioner provisioner
}

func NewService(viewers viewerReader, provisioner provisioner) *Service {
	return &Service{viewers: viewers, provisioner: provisioner}
}

func (s *Service) Viewer(ctx context.Context, realm, subject string) (Viewer, error) {
	row, err := s.viewers.GetViewer(ctx, realm, subject)
	if errors.Is(err, pgx.ErrNoRows) {
		return Viewer{}, ErrUnknownIdentity
	}
	if err != nil {
		return Viewer{}, err
	}
	if row.SyncStatus != "CURRENT" {
		return Viewer{}, ErrUnavailableIdentity
	}
	if row.AccountState != "ACTIVE" {
		return Viewer{}, ErrInactiveAccount
	}
	if row.ProductUserID == "" || (row.OnboardingState != "NOT_STARTED" && row.OnboardingState != "IN_PROGRESS" && row.OnboardingState != "COMPLETE") {
		return Viewer{}, ErrInvalidProjection
	}
	roles := make([]string, len(row.SelfServiceRoles))
	for index, role := range row.SelfServiceRoles {
		if role != string(identity.RoleStudent) && role != string(identity.RoleSponsor) {
			return Viewer{}, ErrInvalidProjection
		}
		roles[index] = role
	}
	return Viewer{
		ProductUserID:    row.ProductUserID,
		AccountState:     row.AccountState,
		OnboardingState:  row.OnboardingState,
		Username:         row.Username,
		DisplayName:      row.DisplayName,
		SelfServiceRoles: roles,
	}, nil
}

func (s *Service) Enroll(ctx context.Context, input EnrollmentInput) (Viewer, error) {
	var role identity.EnrollmentRole
	switch input.Role {
	case string(identity.RoleStudent):
		role = identity.RoleStudent
	case string(identity.RoleSponsor):
		role = identity.RoleSponsor
	default:
		return Viewer{}, ErrInvalidEnrollment
	}
	_, err := s.provisioner.Provision(ctx, identity.ProvisionInput{
		RealmKey:        input.Realm,
		AuthSystem:      "BETTER_AUTH",
		Issuer:          "",
		IdentitySubject: input.Subject,
		EnrollmentRole:  role,
		VerifiedEmail:   input.VerifiedEmail,
	})
	if errors.Is(err, identity.ErrInvalidInput) {
		return Viewer{}, ErrInvalidEnrollment
	}
	if err != nil {
		return Viewer{}, err
	}
	return s.Viewer(ctx, input.Realm, input.Subject)
}
