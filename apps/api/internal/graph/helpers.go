package graph

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/local/quorum/apps/api/internal/auth"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/graph/model"
)

func (r *Resolver) user(ctx context.Context, user db.User) (*model.User, error) {
	tags, err := r.Queries.ListUserTags(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	outTags := make([]*model.Tag, 0, len(tags))
	for _, tag := range tags {
		outTags = append(outTags, tagModel(tag))
	}
	return userModel(user, outTags), nil
}

func (r *Resolver) team(ctx context.Context, team db.Team) (*model.Team, error) {
	createdBy, err := r.Queries.GetUser(ctx, team.CreatedBy)
	if err != nil {
		return nil, err
	}
	creator, err := r.user(ctx, createdBy)
	if err != nil {
		return nil, err
	}

	memberRows, err := r.Queries.ListTeamMembers(ctx, team.ID)
	if err != nil {
		return nil, err
	}
	members := make([]*model.TeamMembership, 0, len(memberRows))
	for _, row := range memberRows {
		user, err := r.Queries.GetUser(ctx, row.UserID)
		if err != nil {
			return nil, err
		}
		memberUser, err := r.user(ctx, user)
		if err != nil {
			return nil, err
		}
		members = append(members, &model.TeamMembership{
			ID:       uuidString(row.ID),
			User:     memberUser,
			Role:     model.TeamRole(row.Role),
			JoinedAt: timeString(row.JoinedAt),
		})
	}

	var project *model.Project
	if team.ProjectID.Valid {
		dbProject, err := r.Queries.GetProject(ctx, team.ProjectID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			project, err = r.shallowProject(ctx, dbProject)
			if err != nil {
				return nil, err
			}
		}
	}
	mapped := teamModel(team, creator, members, project)
	for _, member := range mapped.Members {
		member.Team = mapped
	}
	return mapped, nil
}

func (r *Resolver) project(ctx context.Context, project db.Project) (*model.Project, error) {
	owner, err := r.Queries.GetUser(ctx, project.OwnerID)
	if err != nil {
		return nil, err
	}
	ownerModel, err := r.user(ctx, owner)
	if err != nil {
		return nil, err
	}

	var team *model.Team
	if project.TeamID.Valid {
		dbTeam, err := r.Queries.GetTeam(ctx, project.TeamID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			team, err = r.shallowTeam(ctx, dbTeam)
			if err != nil {
				return nil, err
			}
		}
	}

	appRows, err := r.Queries.ListProjectApplications(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	apps := make([]*model.ProjectApplication, 0, len(appRows))
	for _, row := range appRows {
		appTeam, err := r.Queries.GetTeam(ctx, row.TeamID)
		if err != nil {
			return nil, err
		}
		mappedTeam, err := r.shallowTeam(ctx, appTeam)
		if err != nil {
			return nil, err
		}
		apps = append(apps, projectApplicationModel(db.ProjectApplication{
			ID:        row.ID,
			ProjectID: row.ProjectID,
			TeamID:    row.TeamID,
			Message:   row.Message,
			Status:    row.Status,
			CreatedAt: row.CreatedAt,
		}, nil, mappedTeam))
	}
	mapped := projectModel(project, ownerModel, team, apps)
	for _, app := range mapped.Applications {
		app.Project = mapped
	}
	return mapped, nil
}

func (r *Resolver) teamMembership(ctx context.Context, member db.TeamMembership) (*model.TeamMembership, error) {
	user, err := r.Queries.GetUser(ctx, member.UserID)
	if err != nil {
		return nil, err
	}
	team, err := r.Queries.GetTeam(ctx, member.TeamID)
	if err != nil {
		return nil, err
	}
	mappedUser, err := r.user(ctx, user)
	if err != nil {
		return nil, err
	}
	mappedTeam, err := r.shallowTeam(ctx, team)
	if err != nil {
		return nil, err
	}
	return &model.TeamMembership{
		ID:       uuidString(member.ID),
		User:     mappedUser,
		Team:     mappedTeam,
		Role:     model.TeamRole(member.Role),
		JoinedAt: timeString(member.JoinedAt),
	}, nil
}

func (r *Resolver) projectApplication(ctx context.Context, application db.ProjectApplication) (*model.ProjectApplication, error) {
	project, err := r.Queries.GetProject(ctx, application.ProjectID)
	if err != nil {
		return nil, err
	}
	team, err := r.Queries.GetTeam(ctx, application.TeamID)
	if err != nil {
		return nil, err
	}
	mappedProject, err := r.shallowProject(ctx, project)
	if err != nil {
		return nil, err
	}
	mappedTeam, err := r.shallowTeam(ctx, team)
	if err != nil {
		return nil, err
	}
	return projectApplicationModel(application, mappedProject, mappedTeam), nil
}

func (r *Resolver) joinRequest(ctx context.Context, request db.TeamJoinRequest) (*model.TeamJoinRequest, error) {
	team, err := r.Queries.GetTeam(ctx, request.TeamID)
	if err != nil {
		return nil, err
	}
	user, err := r.Queries.GetUser(ctx, request.UserID)
	if err != nil {
		return nil, err
	}
	mappedUser, err := r.user(ctx, user)
	if err != nil {
		return nil, err
	}
	mappedTeam, err := r.shallowTeam(ctx, team)
	if err != nil {
		return nil, err
	}
	return &model.TeamJoinRequest{
		ID:        uuidString(request.ID),
		Team:      mappedTeam,
		User:      mappedUser,
		Message:   textPointer(request.Message),
		Status:    model.ApplicationStatus(request.Status),
		CreatedAt: timeString(request.CreatedAt),
	}, nil
}

func (r *Resolver) shallowUser(_ context.Context, user db.User) (*model.User, error) {
	return userModel(user, []*model.Tag{}), nil
}

func (r *Resolver) shallowTeam(ctx context.Context, team db.Team) (*model.Team, error) {
	creator, err := r.Queries.GetUser(ctx, team.CreatedBy)
	if err != nil {
		return nil, err
	}
	mappedCreator, err := r.shallowUser(ctx, creator)
	if err != nil {
		return nil, err
	}
	return teamModel(team, mappedCreator, []*model.TeamMembership{}, nil), nil
}

func (r *Resolver) shallowProject(ctx context.Context, project db.Project) (*model.Project, error) {
	owner, err := r.Queries.GetUser(ctx, project.OwnerID)
	if err != nil {
		return nil, err
	}
	mappedOwner, err := r.shallowUser(ctx, owner)
	if err != nil {
		return nil, err
	}
	return projectModel(project, mappedOwner, nil, []*model.ProjectApplication{}), nil
}

func (r *Resolver) message(ctx context.Context, message db.Message) (*model.Message, error) {
	sender, err := r.Queries.GetUser(ctx, message.SenderID)
	if err != nil {
		return nil, err
	}
	receiver, err := r.Queries.GetUser(ctx, message.ReceiverID)
	if err != nil {
		return nil, err
	}
	mappedSender, err := r.user(ctx, sender)
	if err != nil {
		return nil, err
	}
	mappedReceiver, err := r.user(ctx, receiver)
	if err != nil {
		return nil, err
	}
	return &model.Message{
		ID:        uuidString(message.ID),
		Sender:    mappedSender,
		Receiver:  mappedReceiver,
		Body:      message.Body,
		Read:      message.Read,
		CreatedAt: timeString(message.CreatedAt),
	}, nil
}

func (r *Resolver) requireTeamLead(ctx context.Context, teamID pgtype.UUID) error {
	current, err := requireUser(ctx)
	if err != nil {
		return err
	}
	members, err := r.Queries.ListTeamMembers(ctx, teamID)
	if err != nil {
		return err
	}
	for _, member := range members {
		if sameUUID(member.UserID, current.ID) && (member.Role == string(model.TeamRoleLead) || member.Role == string(model.TeamRoleCoLead)) {
			return nil
		}
	}
	return errors.New("team lead access required")
}

func (r *Resolver) requireProjectOwner(ctx context.Context, projectID pgtype.UUID) error {
	current, err := requireUser(ctx)
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

func requireUser(ctx context.Context) (db.User, error) {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return db.User{}, errors.New("authentication required")
	}
	return user, nil
}

func userModel(user db.User, tags []*model.Tag) *model.User {
	return &model.User{
		ID:           uuidString(user.ID),
		AuthUserID:   user.AuthUserID,
		Username:     user.Username,
		Email:        textPointer(user.Email),
		FullName:     user.FullName,
		Bio:          textPointer(user.Bio),
		Discipline:   textPointer(user.Discipline),
		University:   textPointer(user.University),
		LinkedinURL:  textPointer(user.LinkedinUrl),
		GithubURL:    textPointer(user.GithubUrl),
		PortfolioURL: textPointer(user.PortfolioUrl),
		ResumeURL:    textPointer(user.ResumeUrl),
		AvatarURL:    textPointer(user.AvatarUrl),
		Tags:         tags,
		CreatedAt:    timeString(user.CreatedAt),
	}
}

func tagModel(tag db.Tag) *model.Tag {
	return &model.Tag{ID: uuidString(tag.ID), Name: tag.Name, IsPredefined: tag.IsPredefined}
}

func teamModel(team db.Team, createdBy *model.User, members []*model.TeamMembership, project *model.Project) *model.Team {
	return &model.Team{
		ID:          uuidString(team.ID),
		Name:        team.Name,
		Description: textPointer(team.Description),
		IsComplete:  team.IsComplete,
		MaxSize:     int(team.MaxSize),
		Discipline:  textPointer(team.Discipline),
		Members:     members,
		Project:     project,
		CreatedBy:   createdBy,
		CreatedAt:   timeString(team.CreatedAt),
	}
}

func projectModel(project db.Project, owner *model.User, team *model.Team, applications []*model.ProjectApplication) *model.Project {
	return &model.Project{
		ID:           uuidString(project.ID),
		Title:        project.Title,
		Description:  project.Description,
		Constraints:  textPointer(project.Constraints),
		Disciplines:  project.Disciplines,
		TeamSizeMin:  int(project.TeamSizeMin),
		TeamSizeMax:  int(project.TeamSizeMax),
		Status:       model.ProjectStatus(project.Status),
		Owner:        owner,
		Team:         team,
		FileURL:      textPointer(project.FileUrl),
		VideoURL:     textPointer(project.VideoUrl),
		Applications: applications,
		CreatedAt:    timeString(project.CreatedAt),
	}
}

func projectApplicationModel(application db.ProjectApplication, project *model.Project, team *model.Team) *model.ProjectApplication {
	return &model.ProjectApplication{
		ID:        uuidString(application.ID),
		Project:   project,
		Team:      team,
		Message:   textPointer(application.Message),
		Status:    model.ApplicationStatus(application.Status),
		CreatedAt: timeString(application.CreatedAt),
	}
}

func notificationModel(notification db.Notification) *model.Notification {
	return &model.Notification{
		ID:        uuidString(notification.ID),
		Type:      notification.Type,
		Payload:   string(notification.Payload),
		Read:      notification.Read,
		CreatedAt: timeString(notification.CreatedAt),
	}
}

func text(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func textPointer(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func boolValue(value *bool) pgtype.Bool {
	if value == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *value, Valid: true}
}

func timeString(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format("2006-01-02T15:04:05Z07:00")
}

func uuid(value string) (pgtype.UUID, error) {
	var out pgtype.UUID
	if err := out.Scan(value); err != nil {
		return pgtype.UUID{}, fmt.Errorf("invalid id %q: %w", value, err)
	}
	return out, nil
}

func uuidString(value pgtype.UUID) string {
	if !value.Valid {
		return ""
	}
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		value.Bytes[0:4],
		value.Bytes[4:6],
		value.Bytes[6:8],
		value.Bytes[8:10],
		value.Bytes[10:16],
	)
}

func sameUUID(a, b pgtype.UUID) bool {
	return a.Valid && b.Valid && a.Bytes == b.Bytes
}
