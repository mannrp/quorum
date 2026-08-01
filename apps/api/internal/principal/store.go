package principal

import (
	"context"

	"github.com/local/quorum/apps/api/internal/db"
)

type SQLViewerStore struct {
	queries *db.Queries
}

func NewSQLViewerStore(queries *db.Queries) *SQLViewerStore {
	return &SQLViewerStore{queries: queries}
}

func (s *SQLViewerStore) GetViewer(ctx context.Context, realm, subject string) (ViewerRow, error) {
	row, err := s.queries.GetViewerBootstrapByRealmSubject(ctx, db.GetViewerBootstrapByRealmSubjectParams{
		RealmKey:        realm,
		IdentitySubject: subject,
	})
	if err != nil {
		return ViewerRow{}, err
	}
	return ViewerRow{
		ProductUserID:    row.ProductUserID,
		AccountState:     row.AccountState,
		SyncStatus:       row.SyncStatus,
		OnboardingState:  row.OnboardingState,
		Username:         optional(row.Username),
		DisplayName:      optional(row.DisplayName),
		SelfServiceRoles: row.SelfServiceRoles,
	}, nil
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
