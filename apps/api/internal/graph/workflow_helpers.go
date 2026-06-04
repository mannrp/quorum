package graph

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/graph/model"
)

var terminalApplicationStatuses = map[string]bool{
	string(model.ApplicationStatusMatched):   true,
	string(model.ApplicationStatusRejected):  true,
	string(model.ApplicationStatusWithdrawn): true,
	string(model.ApplicationStatusExpired):   true,
}

var terminalJoinRequestStatuses = map[string]bool{
	string(model.JoinRequestStatusConfirmed): true,
	string(model.JoinRequestStatusRejected):  true,
	string(model.JoinRequestStatusWithdrawn): true,
	string(model.JoinRequestStatusExpired):   true,
}

var terminalInvitationStatuses = map[string]bool{
	string(model.TeamInvitationStatusAccepted):  true,
	string(model.TeamInvitationStatusDeclined):  true,
	string(model.TeamInvitationStatusWithdrawn): true,
	string(model.TeamInvitationStatusExpired):   true,
}

func (r *Resolver) withTx(ctx context.Context, fn func(*db.Queries) error) error {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(r.Queries.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func requireActiveUser(ctx context.Context) (db.User, error) {
	user, err := requireUser(ctx)
	if err != nil {
		return db.User{}, err
	}
	if user.DeactivatedAt.Valid || user.ArchivedAt.Valid {
		return db.User{}, errors.New("account is deactivated")
	}
	return user, nil
}

func requireCompleteUser(ctx context.Context) (db.User, error) {
	user, err := requireActiveUser(ctx)
	if err != nil {
		return db.User{}, err
	}
	if !user.ProfileComplete {
		return db.User{}, errors.New("complete your profile before continuing")
	}
	return user, nil
}

func (r *Resolver) requireDeadlineOpen(ctx context.Context) error {
	deadline, err := r.Queries.GetUniversalDeadline(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if deadline.DeadlineAt.Valid && !time.Now().UTC().Before(deadline.DeadlineAt.Time.UTC()) {
		return errors.New("the capstone deadline has passed")
	}
	return nil
}

func (r *Resolver) confirmationExpiresAt(ctx context.Context) (pgtype.Timestamptz, error) {
	expires := time.Now().UTC().Add(72 * time.Hour)
	deadline, err := r.Queries.GetUniversalDeadline(ctx)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return pgtype.Timestamptz{}, err
	}
	if err == nil && deadline.DeadlineAt.Valid && deadline.DeadlineAt.Time.UTC().Before(expires) {
		expires = deadline.DeadlineAt.Time.UTC()
	}
	return pgtime(expires), nil
}

func (r *Resolver) expireDueWorkflows(ctx context.Context, q *db.Queries) error {
	cutoff := time.Now().UTC()
	deadline, err := q.GetUniversalDeadline(ctx)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if err == nil && deadline.DeadlineAt.Valid && !cutoff.Before(deadline.DeadlineAt.Time.UTC()) {
		cutoff = cutoff.AddDate(100, 0, 0)
	}
	ts := pgtime(cutoff)
	if err := q.ExpireDueJoinRequests(ctx, ts); err != nil {
		return err
	}
	if err := q.ExpireDueTeamInvitations(ctx, ts); err != nil {
		return err
	}
	return q.ExpireDueProjectOffers(ctx, ts)
}

func (r *Resolver) isExpired(ctx context.Context, expiresAt pgtype.Timestamptz) (bool, error) {
	now := time.Now().UTC()
	if expiresAt.Valid && !now.Before(expiresAt.Time.UTC()) {
		return true, nil
	}
	deadline, err := r.Queries.GetUniversalDeadline(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return deadline.DeadlineAt.Valid && !now.Before(deadline.DeadlineAt.Time.UTC()), nil
}

func (r *Resolver) requireLeadOnly(ctx context.Context, teamID pgtype.UUID) error {
	current, err := requireActiveUser(ctx)
	if err != nil {
		return err
	}
	membership, err := r.Queries.GetTeamMembership(ctx, db.GetTeamMembershipParams{TeamID: teamID, UserID: current.ID})
	if err != nil {
		return err
	}
	if membership.Role != string(model.TeamRoleLead) {
		return errors.New("team lead access required")
	}
	return nil
}

func (r *Resolver) requireTeamLead(ctx context.Context, teamID pgtype.UUID) error {
	current, err := requireActiveUser(ctx)
	if err != nil {
		return err
	}
	membership, err := r.Queries.GetTeamMembership(ctx, db.GetTeamMembershipParams{TeamID: teamID, UserID: current.ID})
	if err != nil {
		return err
	}
	if membership.Role == string(model.TeamRoleLead) || membership.Role == string(model.TeamRoleCoLead) {
		return nil
	}
	return errors.New("team lead access required")
}

func (r *Resolver) requireProjectOwner(ctx context.Context, projectID pgtype.UUID) error {
	current, err := requireActiveUser(ctx)
	if err != nil {
		return err
	}
	project, err := r.Queries.GetProject(ctx, projectID)
	if err != nil {
		return err
	}
	if !sameUUID(project.OwnerID, current.ID) {
		return errors.New("project owner access required")
	}
	return nil
}

func snapshot(value any) []byte {
	data, err := json.Marshal(value)
	if err != nil || len(data) == 0 {
		return []byte("{}")
	}
	return data
}

func (r *Resolver) auditChange(ctx context.Context, q *db.Queries, actorID pgtype.UUID, actionType string, targetType string, targetID pgtype.UUID, previous any, next any, reason *string) error {
	_, err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		ActorUserID:      actorID,
		ActionType:       actionType,
		TargetEntityType: targetType,
		TargetEntityID:   targetID,
		PreviousValue:    snapshot(previous),
		NewValue:         snapshot(next),
		Reason:           text(reason),
		Metadata:         []byte("{}"),
	})
	return err
}

func (r *Resolver) notifyUser(ctx context.Context, q *db.Queries, userID pgtype.UUID, typ string, payload map[string]any) {
	if payload == nil {
		payload = map[string]any{}
	}
	_, _ = q.CreateNotification(ctx, db.CreateNotificationParams{
		UserID:  userID,
		Type:    typ,
		Payload: snapshot(payload),
	})
}

func statusSnapshot(status string) map[string]any {
	return map[string]any{"status": status}
}

func teamStateSnapshot(team db.Team) map[string]any {
	return map[string]any{
		"id":              uuidString(team.ID),
		"recruitingState": team.RecruitingState,
		"capstoneState":   team.CapstoneState,
		"visibility":      team.Visibility,
		"archivedAt":      timeStringPointer(team.ArchivedAt),
	}
}

func projectStateSnapshot(project db.Project) map[string]any {
	return map[string]any{
		"id":             uuidString(project.ID),
		"status":         project.Status,
		"lifecycleState": project.LifecycleState,
		"approvalState":  project.ApprovalState,
		"teamId":         uuidStringPointer(project.TeamID),
		"archivedAt":     timeStringPointer(project.ArchivedAt),
	}
}
