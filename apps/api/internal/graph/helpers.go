package graph

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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
	mapped.Permissions = r.teamPermissions(ctx, team)
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
	for _, application := range appRows {
		mapped, err := r.projectApplicationWithProject(ctx, application, nil, true)
		if err != nil {
			return nil, err
		}
		apps = append(apps, mapped)
	}
	mapped := projectModel(project, ownerModel, team, apps)
	mapped.Permissions = r.projectPermissions(ctx, project)
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
	mappedProject, err := r.shallowProject(ctx, project)
	if err != nil {
		return nil, err
	}
	return r.projectApplicationWithProject(ctx, application, mappedProject, true)
}

func (r *Resolver) projectApplicationWithProject(ctx context.Context, application db.ProjectApplication, mappedProject *model.Project, fullTeam bool) (*model.ProjectApplication, error) {
	team, err := r.Queries.GetTeam(ctx, application.TeamID)
	if err != nil {
		return nil, err
	}
	var mappedTeam *model.Team
	if fullTeam {
		mappedTeam, err = r.team(ctx, team)
	} else {
		mappedTeam, err = r.shallowTeam(ctx, team)
	}
	if err != nil {
		return nil, err
	}
	var applicant *model.User
	if application.ApplicantID.Valid {
		user, err := r.Queries.GetUser(ctx, application.ApplicantID)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			applicant, err = r.user(ctx, user)
		}
		if err != nil {
			return nil, err
		}
	}
	return projectApplicationModel(application, mappedProject, mappedTeam, applicant), nil
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
		ID:          uuidString(request.ID),
		Team:        mappedTeam,
		User:        mappedUser,
		Message:     textPointer(request.Message),
		Status:      model.JoinRequestStatus(request.Status),
		ExpiresAt:   timeStringPointer(request.ExpiresAt),
		RespondedAt: timeStringPointer(request.RespondedAt),
		ConfirmedAt: timeStringPointer(request.ConfirmedAt),
		CreatedAt:   timeString(request.CreatedAt),
	}, nil
}

func (r *Resolver) teamInvitation(ctx context.Context, invitation db.TeamInvitation) (*model.TeamInvitation, error) {
	team, err := r.Queries.GetTeam(ctx, invitation.TeamID)
	if err != nil {
		return nil, err
	}
	invitedUser, err := r.Queries.GetUser(ctx, invitation.InvitedUserID)
	if err != nil {
		return nil, err
	}
	invitedBy, err := r.Queries.GetUser(ctx, invitation.InvitedBy)
	if err != nil {
		return nil, err
	}
	mappedTeam, err := r.shallowTeam(ctx, team)
	if err != nil {
		return nil, err
	}
	mappedUser, err := r.user(ctx, invitedUser)
	if err != nil {
		return nil, err
	}
	mappedBy, err := r.user(ctx, invitedBy)
	if err != nil {
		return nil, err
	}
	return &model.TeamInvitation{
		ID:          uuidString(invitation.ID),
		Team:        mappedTeam,
		InvitedUser: mappedUser,
		InvitedBy:   mappedBy,
		Message:     textPointer(invitation.Message),
		Status:      model.TeamInvitationStatus(invitation.Status),
		ExpiresAt:   timeString(invitation.ExpiresAt),
		RespondedAt: timeStringPointer(invitation.RespondedAt),
		CreatedAt:   timeString(invitation.CreatedAt),
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
	mapped := teamModel(team, mappedCreator, []*model.TeamMembership{}, nil)
	mapped.Permissions = r.teamPermissions(ctx, team)
	return mapped, nil
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
	mapped := projectModel(project, mappedOwner, nil, []*model.ProjectApplication{})
	mapped.Permissions = r.projectPermissions(ctx, project)
	return mapped, nil
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

func (r *Resolver) deadline(ctx context.Context, deadline db.UniversalDeadline) (*model.Deadline, error) {
	var updatedBy *model.User
	if deadline.UpdatedBy.Valid {
		user, err := r.Queries.GetUser(ctx, deadline.UpdatedBy)
		if err == nil {
			updatedBy, _ = r.shallowUser(ctx, user)
		}
	}
	return deadlineModel(deadline, updatedBy), nil
}

func (r *Resolver) requireAdmin(ctx context.Context) (db.User, error) {
	current, err := requireActiveUser(ctx)
	if err != nil {
		return db.User{}, err
	}
	isAdmin, err := r.Queries.IsAdmin(ctx, current.ID)
	if err != nil {
		return db.User{}, err
	}
	if !isAdmin {
		return db.User{}, errors.New("admin access required")
	}
	return current, nil
}

func (r *Resolver) teamPermissions(ctx context.Context, team db.Team) *model.TeamPermissions {
	permissions := &model.TeamPermissions{}
	current, ok := auth.UserFromContext(ctx)
	if !ok {
		return permissions
	}
	membership, err := r.Queries.GetTeamMembership(ctx, db.GetTeamMembershipParams{TeamID: team.ID, UserID: current.ID})
	if err != nil {
		return permissions
	}
	isLead := membership.Role == string(model.TeamRoleLead)
	isTeamLead := isLead || membership.Role == string(model.TeamRoleCoLead)
	permissions.CanEdit = isTeamLead
	permissions.CanManageMembers = isTeamLead
	permissions.CanInviteMembers = isTeamLead
	permissions.CanArchive = isLead
	permissions.CanApplyToProjects = isTeamLead
	return permissions
}

func (r *Resolver) projectPermissions(ctx context.Context, project db.Project) *model.ProjectPermissions {
	permissions := &model.ProjectPermissions{}
	current, ok := auth.UserFromContext(ctx)
	if !ok {
		return permissions
	}
	isOwner := sameUUID(project.OwnerID, current.ID)
	permissions.CanEdit = isOwner
	permissions.CanReviewApplications = isOwner
	permissions.CanSubmitForApproval = isOwner
	permissions.CanArchive = isOwner
	if isAdmin, err := r.Queries.IsAdmin(ctx, current.ID); err == nil {
		permissions.CanApprove = isAdmin
	}
	return permissions
}

func (r *Resolver) audit(ctx context.Context, actorID pgtype.UUID, actionType string, targetType string, targetID pgtype.UUID, reason *string) error {
	_, err := r.Queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
		ActorUserID:      actorID,
		ActionType:       actionType,
		TargetEntityType: targetType,
		TargetEntityID:   targetID,
		PreviousValue:    []byte("{}"),
		NewValue:         []byte("{}"),
		Reason:           text(reason),
		Metadata:         []byte("{}"),
	})
	return err
}

func (r *mutationResolver) applyToProject(ctx context.Context, projectID string, teamID string, message *string, answers []byte) (*model.ProjectApplication, error) {
	current, err := requireCompleteUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := r.requireDeadlineOpen(ctx); err != nil {
		return nil, err
	}
	tid, err := uuid(teamID)
	if err != nil {
		return nil, err
	}
	pid, err := uuid(projectID)
	if err != nil {
		return nil, err
	}
	if err := r.requireTeamLead(ctx, tid); err != nil {
		return nil, err
	}
	if err := r.expireDueWorkflows(ctx, r.Queries); err != nil {
		return nil, err
	}
	team, err := r.Queries.GetTeam(ctx, tid)
	if err != nil {
		return nil, err
	}
	if team.ArchivedAt.Valid || team.CapstoneState == string(model.TeamCapstoneStateClosed) || team.CapstoneState == string(model.TeamCapstoneStateMatched) {
		return nil, errors.New("team is not eligible to apply")
	}
	project, err := r.Queries.GetProject(ctx, pid)
	if err != nil {
		return nil, err
	}
	if project.ArchivedAt.Valid || project.LifecycleState == string(model.ProjectLifecycleStateClosed) || project.LifecycleState == string(model.ProjectLifecycleStateArchived) || project.LifecycleState == string(model.ProjectLifecycleStateMatched) {
		return nil, errors.New("project is not accepting applications")
	}
	if sameUUID(project.OwnerID, current.ID) {
		return nil, errors.New("project owners cannot apply to their own project")
	}
	existing, err := r.Queries.GetProjectApplicationForTeamProject(ctx, db.GetProjectApplicationForTeamProjectParams{ProjectID: pid, TeamID: tid})
	if err == nil {
		if !terminalApplicationStatuses[existing.Status] {
			return r.projectApplication(ctx, existing)
		}
		return nil, errors.New("team has already applied to this project")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	var application db.ProjectApplication
	if err := r.withTx(ctx, func(q *db.Queries) error {
		var err error
		application, err = q.ApplyToProject(ctx, db.ApplyToProjectParams{ProjectID: pid, TeamID: tid, ApplicantID: current.ID, Message: text(message), Answers: answers})
		if err != nil {
			return err
		}
		if err := q.UpdateTeamCapstoneState(ctx, db.UpdateTeamCapstoneStateParams{ID: tid, CapstoneState: string(model.TeamCapstoneStateApplying)}); err != nil {
			return err
		}
		if _, err := q.UpdateProjectLifecycleState(ctx, db.UpdateProjectLifecycleStateParams{ID: pid, LifecycleState: string(model.ProjectLifecycleStateReviewing)}); err != nil {
			return err
		}
		r.notifyUser(ctx, q, project.OwnerID, "PROJECT_APPLICATION_SUBMITTED", map[string]any{"applicationId": uuidString(application.ID), "projectId": uuidString(pid), "teamId": uuidString(tid)})
		return r.auditChange(ctx, q, current.ID, "PROJECT_APPLICATION_SUBMITTED", "PROJECT_APPLICATION", application.ID, map[string]any{}, statusSnapshot(application.Status), nil)
	}); err != nil {
		return nil, err
	}
	return r.projectApplication(ctx, application)
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
		ID:                    uuidString(user.ID),
		AuthUserID:            user.AuthUserID,
		Username:              user.Username,
		Email:                 textPointer(user.Email),
		FullName:              user.FullName,
		Bio:                   textPointer(user.Bio),
		Discipline:            textPointer(user.Discipline),
		University:            textPointer(user.University),
		LinkedinURL:           textPointer(user.LinkedinUrl),
		GithubURL:             textPointer(user.GithubUrl),
		PortfolioURL:          textPointer(user.PortfolioUrl),
		ResumeURL:             textPointer(user.ResumeUrl),
		AvatarURL:             textPointer(user.AvatarUrl),
		UserIntent:            user.UserIntent,
		ResumeVisibility:      model.ResumeVisibility(user.ResumeVisibility),
		Discord:               textPointer(user.Discord),
		AvailabilityNote:      textPointer(user.AvailabilityNote),
		PreferredProjectAreas: user.PreferredProjectAreas,
		ProfileComplete:       user.ProfileComplete,
		DeactivatedAt:         timeStringPointer(user.DeactivatedAt),
		ArchivedAt:            timeStringPointer(user.ArchivedAt),
		Tags:                  tags,
		CreatedAt:             timeString(user.CreatedAt),
	}
}

func tagModel(tag db.Tag) *model.Tag {
	return &model.Tag{ID: uuidString(tag.ID), Name: tag.Name, IsPredefined: tag.IsPredefined}
}

func teamModel(team db.Team, createdBy *model.User, members []*model.TeamMembership, project *model.Project) *model.Team {
	return &model.Team{
		ID:               uuidString(team.ID),
		Name:             team.Name,
		Description:      textPointer(team.Description),
		IsComplete:       team.IsComplete,
		MaxSize:          int(team.MaxSize),
		Discipline:       textPointer(team.Discipline),
		RecruitingState:  model.TeamRecruitingState(team.RecruitingState),
		CapstoneState:    model.TeamCapstoneState(team.CapstoneState),
		Visibility:       model.TeamVisibility(team.Visibility),
		DiscordLink:      textPointer(team.DiscordLink),
		ExistingSkills:   team.ExistingSkills,
		NeededSkills:     team.NeededSkills,
		ProjectInterests: team.ProjectInterests,
		ArchivedAt:       timeStringPointer(team.ArchivedAt),
		Permissions:      &model.TeamPermissions{},
		Members:          members,
		Project:          project,
		CreatedBy:        createdBy,
		CreatedAt:        timeString(team.CreatedAt),
	}
}

func projectModel(project db.Project, owner *model.User, team *model.Team, applications []*model.ProjectApplication) *model.Project {
	return &model.Project{
		ID:                     uuidString(project.ID),
		Title:                  project.Title,
		Summary:                project.Summary,
		Description:            project.Description,
		Constraints:            textPointer(project.Constraints),
		Disciplines:            project.Disciplines,
		TeamSizeMin:            int(project.TeamSizeMin),
		TeamSizeMax:            int(project.TeamSizeMax),
		Status:                 model.ProjectStatus(project.Status),
		LifecycleState:         model.ProjectLifecycleState(project.LifecycleState),
		ApprovalState:          model.ProjectApprovalState(project.ApprovalState),
		RequiredSkills:         project.RequiredSkills,
		NiceToHaveSkills:       project.NiceToHaveSkills,
		Deliverables:           textPointer(project.Deliverables),
		Timeline:               textPointer(project.Timeline),
		EvaluationCriteria:     textPointer(project.EvaluationCriteria),
		ExternalResources:      project.ExternalResources,
		OwnerContactPreference: textPointer(project.OwnerContactPreference),
		ApplicationQuestions:   string(project.ApplicationQuestions),
		ArchivedAt:             timeStringPointer(project.ArchivedAt),
		Permissions:            &model.ProjectPermissions{},
		Owner:                  owner,
		Team:                   team,
		FileURL:                textPointer(project.FileUrl),
		VideoURL:               textPointer(project.VideoUrl),
		Applications:           applications,
		CreatedAt:              timeString(project.CreatedAt),
	}
}

func projectApplicationModel(application db.ProjectApplication, project *model.Project, team *model.Team, applicant *model.User) *model.ProjectApplication {
	return &model.ProjectApplication{
		ID:               uuidString(application.ID),
		Project:          project,
		Team:             team,
		Applicant:        applicant,
		Message:          textPointer(application.Message),
		Answers:          string(application.Answers),
		Status:           model.ApplicationStatus(application.Status),
		ReviewMessage:    textPointer(application.ReviewMessage),
		OfferMessage:     textPointer(application.OfferMessage),
		TeamConfirmedAt:  timeStringPointer(application.TeamConfirmedAt),
		OwnerConfirmedAt: timeStringPointer(application.OwnerConfirmedAt),
		ExpiresAt:        timeStringPointer(application.ExpiresAt),
		WithdrawnAt:      timeStringPointer(application.WithdrawnAt),
		CreatedAt:        timeString(application.CreatedAt),
	}
}

func deadlineModel(deadline db.UniversalDeadline, updatedBy *model.User) *model.Deadline {
	return &model.Deadline{
		ID:         deadline.ID,
		DeadlineAt: timeString(deadline.DeadlineAt),
		UpdatedBy:  updatedBy,
		UpdatedAt:  timeString(deadline.UpdatedAt),
	}
}

func auditLogModel(log db.AuditLog, actor *model.User) *model.AuditLog {
	targetID := uuidStringPointer(log.TargetEntityID)
	return &model.AuditLog{
		ID:               uuidString(log.ID),
		Actor:            actor,
		ActionType:       log.ActionType,
		TargetEntityType: log.TargetEntityType,
		TargetEntityID:   targetID,
		PreviousValue:    bytesPointer(log.PreviousValue),
		NewValue:         bytesPointer(log.NewValue),
		Reason:           textPointer(log.Reason),
		Metadata:         string(log.Metadata),
		CreatedAt:        timeString(log.CreatedAt),
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

func textString(value string) pgtype.Text {
	return pgtype.Text{String: value, Valid: true}
}

func textPointer(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func textOrCurrent(value *string, fallback pgtype.Text) pgtype.Text {
	if value == nil {
		return fallback
	}
	return text(value)
}

func boolValue(value *bool) pgtype.Bool {
	if value == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *value, Valid: true}
}

func pgtime(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func derefString(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	return *value
}

func derefBool(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func derefResumeVisibility(value *model.ResumeVisibility, fallback string) string {
	if value == nil {
		return fallback
	}
	return string(*value)
}

func derefTeamRecruiting(value *model.TeamRecruitingState, fallback string) string {
	if value == nil {
		return fallback
	}
	return string(*value)
}

func derefTeamVisibility(value *model.TeamVisibility, fallback string) string {
	if value == nil {
		return fallback
	}
	return string(*value)
}

func derefProjectLifecycle(value *model.ProjectLifecycleState, fallback string) string {
	if value == nil {
		return fallback
	}
	return string(*value)
}

func lifecycleForProjectUpdate(lifecycle *model.ProjectLifecycleState, status *model.ProjectStatus, fallback string) string {
	if lifecycle != nil {
		return string(*lifecycle)
	}
	if status == nil {
		return fallback
	}
	switch *status {
	case model.ProjectStatusInReview:
		return string(model.ProjectLifecycleStateReviewing)
	case model.ProjectStatusClaimed:
		return string(model.ProjectLifecycleStateMatched)
	case model.ProjectStatusClosed:
		return string(model.ProjectLifecycleStateClosed)
	default:
		return string(model.ProjectLifecycleStateOpen)
	}
}

func derefProjectApproval(value *model.ProjectApprovalState, fallback string) string {
	if value == nil {
		return fallback
	}
	return string(*value)
}

func stringsOrCurrent(value []string, fallback []string) []string {
	if value == nil {
		return fallback
	}
	return value
}

func bytesOrCurrent(value *string, fallback []byte) []byte {
	if value == nil {
		return fallback
	}
	return []byte(*value)
}

func profileSkills(input model.UpdateProfileInput) ([]string, bool) {
	if input.Skills != nil {
		return normalizeSkillNames(input.Skills), true
	}
	if input.Tags != nil {
		return normalizeSkillNames(input.Tags), true
	}
	return nil, false
}

func normalizeSkillNames(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		name := strings.Join(strings.Fields(value), " ")
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, name)
	}
	return out
}

func profileComplete(input model.UpdateProfileInput, skills []string, replaceSkills bool) bool {
	hasSkills := !replaceSkills || len(skills) >= 3
	return input.FullName != "" &&
		input.Bio != nil && *input.Bio != "" &&
		input.Discipline != nil && *input.Discipline != "" &&
		input.University != nil && *input.University != "" &&
		hasSkills
}

func timeString(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format("2006-01-02T15:04:05Z07:00")
}

func timeStringPointer(value pgtype.Timestamptz) *string {
	if !value.Valid {
		return nil
	}
	out := timeString(value)
	return &out
}

func uuidStringPointer(value pgtype.UUID) *string {
	if !value.Valid {
		return nil
	}
	out := uuidString(value)
	return &out
}

func bytesPointer(value []byte) *string {
	if len(value) == 0 {
		return nil
	}
	out := string(value)
	return &out
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
