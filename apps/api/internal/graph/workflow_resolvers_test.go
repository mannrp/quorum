package graph

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/auth"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/graph/model"
)

func TestCreateTeamRequiresCompleteProfile(t *testing.T) {
	incomplete := db.User{Username: "incomplete", FullName: "Incomplete User"}
	resolver := &mutationResolver{&Resolver{}}
	_, err := resolver.CreateTeam(auth.WithUser(context.Background(), incomplete), model.CreateTeamInput{Name: "Blocked"})
	if err == nil || !strings.Contains(err.Error(), "complete your profile") {
		t.Fatalf("CreateTeam error = %v, want profile-complete gate", err)
	}
}

func TestNonLeadCannotInviteTeamMember(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	member := createWorkflowUser(t, ctx, r.Queries, "member", true)
	invitee := createWorkflowUser(t, ctx, r.Queries, "invitee", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Permission Team")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: member.ID, Role: string(model.TeamRoleMember)}); err != nil {
		t.Fatal(err)
	}

	_, err := (&mutationResolver{r}).InviteTeamMember(auth.WithUser(ctx, member), uuidString(team.ID), uuidString(invitee.ID), nil)
	if err == nil || !strings.Contains(err.Error(), "team lead access required") {
		t.Fatalf("InviteTeamMember error = %v, want team lead access required", err)
	}
}

func TestExpiredInvitationCannotAddMember(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	invitee := createWorkflowUser(t, ctx, r.Queries, "invitee", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Expired Invitation Team")

	var invitationID pgtype.UUID
	if err := r.Pool.QueryRow(ctx, `
INSERT INTO team_invitations (team_id, invited_user_id, invited_by, expires_at)
VALUES ($1, $2, $3, now() - interval '1 hour')
RETURNING id`, team.ID, invitee.ID, lead.ID).Scan(&invitationID); err != nil {
		t.Fatal(err)
	}

	invitation, err := (&mutationResolver{r}).RespondToTeamInvitation(auth.WithUser(ctx, invitee), uuidString(invitationID), true)
	if err != nil {
		t.Fatal(err)
	}
	if invitation.Status != model.TeamInvitationStatusExpired {
		t.Fatalf("invitation status = %s, want EXPIRED", invitation.Status)
	}
	count, err := r.Queries.CountUserTeams(ctx, invitee.ID)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("invitee team count = %d, want 0", count)
	}
}

func TestFinalMatchWithdrawsCompetingApplications(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	lead1 := createWorkflowUser(t, ctx, r.Queries, "lead1", true)
	lead2 := createWorkflowUser(t, ctx, r.Queries, "lead2", true)
	team1 := createWorkflowTeam(t, ctx, r.Queries, lead1, "Match Team 1")
	team2 := createWorkflowTeam(t, ctx, r.Queries, lead2, "Match Team 2")
	project1 := createWorkflowProject(t, ctx, r.Queries, owner, "Match Project 1")
	project2 := createWorkflowProject(t, ctx, r.Queries, owner, "Match Project 2")

	app1 := createWorkflowApplication(t, ctx, r.Pool, project1.ID, team1.ID, lead1.ID, string(model.ApplicationStatusTeamConfirmed))
	app2 := createWorkflowApplication(t, ctx, r.Pool, project2.ID, team1.ID, lead1.ID, string(model.ApplicationStatusSubmitted))
	app3 := createWorkflowApplication(t, ctx, r.Pool, project1.ID, team2.ID, lead2.ID, string(model.ApplicationStatusSubmitted))

	matched, err := (&mutationResolver{r}).ConfirmProjectOfferByOwner(auth.WithUser(ctx, owner), uuidString(app1))
	if err != nil {
		t.Fatal(err)
	}
	if matched.Status != model.ApplicationStatusMatched {
		t.Fatalf("matched status = %s, want MATCHED", matched.Status)
	}
	assertApplicationStatus(t, ctx, r.Queries, app2, string(model.ApplicationStatusWithdrawn))
	assertApplicationStatus(t, ctx, r.Queries, app3, string(model.ApplicationStatusWithdrawn))

	updatedTeam, err := r.Queries.GetTeam(ctx, team1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updatedTeam.CapstoneState != string(model.TeamCapstoneStateMatched) {
		t.Fatalf("team capstone state = %s, want MATCHED", updatedTeam.CapstoneState)
	}
	updatedProject, err := r.Queries.GetProject(ctx, project1.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updatedProject.LifecycleState != string(model.ProjectLifecycleStateMatched) || !sameUUID(updatedProject.TeamID, team1.ID) {
		t.Fatalf("project state = %s team=%s, want MATCHED and team1", updatedProject.LifecycleState, uuidString(updatedProject.TeamID))
	}
}

func TestNonOwnerCannotReviewOrFinalizeApplications(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	otherOwner := createWorkflowUser(t, ctx, r.Queries, "other_owner", true)
	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Application Permission Team")
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Application Permission Project")

	submitted := createWorkflowApplication(t, ctx, r.Pool, project.ID, team.ID, lead.ID, string(model.ApplicationStatusSubmitted))
	teamConfirmed := createWorkflowApplicationForProject(t, ctx, r.Pool, project.ID, team.ID, lead.ID, string(model.ApplicationStatusTeamConfirmed), "Permission Finalize Project")

	mutation := &mutationResolver{r}
	_, err := mutation.RejectApplication(auth.WithUser(ctx, otherOwner), uuidString(submitted), nil)
	assertErrorContains(t, err, "project owner access required")
	_, err = mutation.SendProjectOffer(auth.WithUser(ctx, otherOwner), uuidString(submitted), nil)
	assertErrorContains(t, err, "project owner access required")
	_, err = mutation.RespondToApplication(auth.WithUser(ctx, otherOwner), uuidString(submitted), false)
	assertErrorContains(t, err, "project owner access required")
	_, err = mutation.ConfirmProjectOfferByOwner(auth.WithUser(ctx, otherOwner), uuidString(teamConfirmed))
	assertErrorContains(t, err, "project owner access required")
}

func TestNonAdminCannotSetDeadlineOrRemoveRecords(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	user := createWorkflowUser(t, ctx, r.Queries, "non_admin", true)
	target := createWorkflowUser(t, ctx, r.Queries, "target", true)
	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Admin Permission Team")
	project := createWorkflowProject(t, ctx, r.Queries, target, "Admin Permission Project")

	mutation := &mutationResolver{r}
	deadline := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	_, err := mutation.SetUniversalDeadline(auth.WithUser(ctx, user), deadline, nil)
	assertErrorContains(t, err, "admin access required")
	_, err = mutation.RemoveUser(auth.WithUser(ctx, user), uuidString(target.ID), nil)
	assertErrorContains(t, err, "admin access required")
	_, err = mutation.RemoveTeam(auth.WithUser(ctx, user), uuidString(team.ID), nil)
	assertErrorContains(t, err, "admin access required")
	_, err = mutation.RemoveProject(auth.WithUser(ctx, user), uuidString(project.ID), nil)
	assertErrorContains(t, err, "admin access required")
	_, err = mutation.ReviewProjectApproval(auth.WithUser(ctx, user), uuidString(project.ID), model.ProjectApprovalStateProfessorApproved, nil)
	assertErrorContains(t, err, "admin access required")
}

func TestDuplicateWorkflowRequestsAreIdempotentUntilTerminal(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	requester := createWorkflowUser(t, ctx, r.Queries, "requester", true)
	invitee := createWorkflowUser(t, ctx, r.Queries, "invitee", true)
	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Duplicate Team")
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Duplicate Project")
	mutation := &mutationResolver{r}

	join1, err := mutation.RequestJoin(auth.WithUser(ctx, requester), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	join2, err := mutation.RequestJoin(auth.WithUser(ctx, requester), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	if join1.ID != join2.ID {
		t.Fatalf("duplicate join request id = %s, want %s", join2.ID, join1.ID)
	}
	if _, err := r.Pool.Exec(ctx, `UPDATE team_join_requests SET status = 'REJECTED' WHERE id = $1`, join1.ID); err != nil {
		t.Fatal(err)
	}
	_, err = mutation.RequestJoin(auth.WithUser(ctx, requester), uuidString(team.ID), nil)
	assertErrorContains(t, err, "already requested")

	invite1, err := mutation.InviteTeamMember(auth.WithUser(ctx, lead), uuidString(team.ID), uuidString(invitee.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	invite2, err := mutation.InviteTeamMember(auth.WithUser(ctx, lead), uuidString(team.ID), uuidString(invitee.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	if invite1.ID != invite2.ID {
		t.Fatalf("duplicate invitation id = %s, want %s", invite2.ID, invite1.ID)
	}
	if _, err := r.Pool.Exec(ctx, `UPDATE team_invitations SET status = 'DECLINED' WHERE id = $1`, invite1.ID); err != nil {
		t.Fatal(err)
	}
	_, err = mutation.InviteTeamMember(auth.WithUser(ctx, lead), uuidString(team.ID), uuidString(invitee.ID), nil)
	assertErrorContains(t, err, "already been invited")

	app1, err := mutation.ApplyToProject(auth.WithUser(ctx, lead), uuidString(project.ID), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	app2, err := mutation.ApplyToProject(auth.WithUser(ctx, lead), uuidString(project.ID), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	if app1.ID != app2.ID {
		t.Fatalf("duplicate application id = %s, want %s", app2.ID, app1.ID)
	}
	if _, err := r.Pool.Exec(ctx, `UPDATE project_applications SET status = 'WITHDRAWN' WHERE id = $1`, app1.ID); err != nil {
		t.Fatal(err)
	}
	_, err = mutation.ApplyToProject(auth.WithUser(ctx, lead), uuidString(project.ID), uuidString(team.ID), nil)
	assertErrorContains(t, err, "already applied")
}

func TestExpiredProjectOffersDoNotMatchTeamOrProject(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Expired Offer Team")
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Expired Offer Project")
	teamApp := createExpiredWorkflowApplication(t, ctx, r.Pool, project.ID, team.ID, lead.ID, string(model.ApplicationStatusOfferSent))

	mutation := &mutationResolver{r}
	expiredByTeam, err := mutation.ConfirmProjectOfferByTeam(auth.WithUser(ctx, lead), uuidString(teamApp))
	if err != nil {
		t.Fatal(err)
	}
	if expiredByTeam.Status != model.ApplicationStatusExpired {
		t.Fatalf("team confirmation status = %s, want EXPIRED", expiredByTeam.Status)
	}
	assertTeamAndProjectNotMatched(t, ctx, r.Queries, team.ID, project.ID)

	team2Lead := createWorkflowUser(t, ctx, r.Queries, "lead2", true)
	team2 := createWorkflowTeam(t, ctx, r.Queries, team2Lead, "Expired Owner Offer Team")
	project2 := createWorkflowProject(t, ctx, r.Queries, owner, "Expired Owner Offer Project")
	ownerApp := createExpiredWorkflowApplication(t, ctx, r.Pool, project2.ID, team2.ID, team2Lead.ID, string(model.ApplicationStatusTeamConfirmed))

	expiredByOwner, err := mutation.ConfirmProjectOfferByOwner(auth.WithUser(ctx, owner), uuidString(ownerApp))
	if err != nil {
		t.Fatal(err)
	}
	if expiredByOwner.Status != model.ApplicationStatusExpired {
		t.Fatalf("owner confirmation status = %s, want EXPIRED", expiredByOwner.Status)
	}
	assertTeamAndProjectNotMatched(t, ctx, r.Queries, team2.ID, project2.ID)
}

func TestProjectWorkflowsRequireCompleteProfile(t *testing.T) {
	incomplete := db.User{Username: "incomplete", FullName: "Incomplete User"}
	resolver := &mutationResolver{&Resolver{}}
	_, err := resolver.CreateProject(auth.WithUser(context.Background(), incomplete), model.CreateProjectInput{
		Title:       "Blocked Project",
		Description: "Blocked Project",
		Disciplines: []string{"SOEN"},
	})
	if err == nil || !strings.Contains(err.Error(), "complete your profile") {
		t.Fatalf("CreateProject error = %v, want profile-complete gate", err)
	}

	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	incompleteApplicant := createWorkflowUser(t, ctx, r.Queries, "incomplete_applicant", false)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Profile Gate Application Team")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: incompleteApplicant.ID, Role: string(model.TeamRoleCoLead)}); err != nil {
		t.Fatal(err)
	}
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Profile Gate Project")

	_, err = (&mutationResolver{r}).ApplyToProject(auth.WithUser(ctx, incompleteApplicant), uuidString(project.ID), uuidString(team.ID), nil)
	if err == nil || !strings.Contains(err.Error(), "complete your profile") {
		t.Fatalf("ApplyToProject error = %v, want profile-complete gate", err)
	}
}

func TestUpdateProfilePersistsSkillsAndComputesCompletion(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	user := createWorkflowUser(t, ctx, r.Queries, "skills_user", false)
	mutation := &mutationResolver{r}
	updated, err := mutation.UpdateProfile(auth.WithUser(ctx, user), model.UpdateProfileInput{
		FullName:        user.FullName,
		Bio:             textStringPointer("Profile with enough skills."),
		Discipline:      textStringPointer("SOEN"),
		University:      textStringPointer("Concordia"),
		UserIntent:      textStringPointer("STUDENT"),
		Skills:          []string{"Go", " React ", "go", "Postgres"},
		ProfileComplete: nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !updated.ProfileComplete {
		t.Fatal("profileComplete = false, want true with required fields and three unique skills")
	}
	if tagNames(updated.Tags) != "Go,Postgres,React" {
		t.Fatalf("tags = %s, want normalized unique skills", tagNames(updated.Tags))
	}

	updated, err = mutation.UpdateProfile(auth.WithUser(ctx, user), model.UpdateProfileInput{
		FullName:        user.FullName,
		Bio:             textStringPointer("Profile with too few skills."),
		Discipline:      textStringPointer("SOEN"),
		University:      textStringPointer("Concordia"),
		UserIntent:      textStringPointer("STUDENT"),
		Tags:            []string{"Rust"},
		ProfileComplete: nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.ProfileComplete {
		t.Fatal("profileComplete = true, want false with fewer than three skills")
	}
	if tagNames(updated.Tags) != "Rust" {
		t.Fatalf("tags = %s, want replaced Rust tag", tagNames(updated.Tags))
	}
}

func TestUpdateProjectAcceptsFrontendEditPayloadAndPreservesOmittedFields(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Frontend Edit Project")

	constraints := "Updated material constraints"
	status := model.ProjectStatusInReview
	updated, err := (&mutationResolver{r}).UpdateProject(auth.WithUser(ctx, owner), uuidString(project.ID), model.UpdateProjectInput{
		Title:       workflowPrefix(ctx) + "Frontend Edited Project",
		Description: "Updated project description",
		Constraints: &constraints,
		Disciplines: []string{"SOEN", "COEN"},
		TeamSizeMin: 2,
		TeamSizeMax: 5,
		Status:      &status,
	})
	if err != nil {
		t.Fatal(err)
	}

	if updated.Summary != "Workflow test project." {
		t.Fatalf("summary = %q, want preserved original summary", updated.Summary)
	}
	if updated.LifecycleState != model.ProjectLifecycleStateReviewing || updated.Status != model.ProjectStatusInReview {
		t.Fatalf("state = %s/%s, want REVIEWING/IN_REVIEW", updated.LifecycleState, updated.Status)
	}
	if updated.ApprovalState != model.ProjectApprovalStateUnverified {
		t.Fatalf("approval state = %s, want preserved UNVERIFIED", updated.ApprovalState)
	}
	if len(updated.RequiredSkills) != 1 || updated.RequiredSkills[0] != "Go" {
		t.Fatalf("required skills = %v, want preserved [Go]", updated.RequiredSkills)
	}
	if updated.ApplicationQuestions != "[]" {
		t.Fatalf("application questions = %q, want preserved []", updated.ApplicationQuestions)
	}
}

func TestCoLeadAllowedActionsExceptLeadOnlyArchive(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	coLead := createWorkflowUser(t, ctx, r.Queries, "co_lead", true)
	member := createWorkflowUser(t, ctx, r.Queries, "member", true)
	invitee := createWorkflowUser(t, ctx, r.Queries, "invitee", true)
	requester := createWorkflowUser(t, ctx, r.Queries, "requester", true)
	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Co Lead Team")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: coLead.ID, Role: string(model.TeamRoleCoLead)}); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: member.ID, Role: string(model.TeamRoleMember)}); err != nil {
		t.Fatal(err)
	}
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Co Lead Project")
	mutation := &mutationResolver{r}

	if _, err := mutation.InviteTeamMember(auth.WithUser(ctx, coLead), uuidString(team.ID), uuidString(invitee.ID), nil); err != nil {
		t.Fatalf("InviteTeamMember as co-lead: %v", err)
	}
	joinRequest, err := mutation.RequestJoin(auth.WithUser(ctx, requester), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := mutation.RespondToJoinRequest(auth.WithUser(ctx, coLead), joinRequest.ID, false); err != nil {
		t.Fatalf("RespondToJoinRequest as co-lead: %v", err)
	}
	if ok, err := mutation.RemoveMember(auth.WithUser(ctx, coLead), uuidString(team.ID), uuidString(member.ID)); err != nil || !ok {
		t.Fatalf("RemoveMember as co-lead ok=%v err=%v", ok, err)
	}
	application, err := mutation.ApplyToProject(auth.WithUser(ctx, coLead), uuidString(project.ID), uuidString(team.ID), nil)
	if err != nil {
		t.Fatalf("ApplyToProject as co-lead: %v", err)
	}
	if _, err := mutation.SendProjectOffer(auth.WithUser(ctx, owner), application.ID, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := mutation.ConfirmProjectOfferByTeam(auth.WithUser(ctx, coLead), application.ID); err != nil {
		t.Fatalf("ConfirmProjectOfferByTeam as co-lead: %v", err)
	}

	project2 := createWorkflowProject(t, ctx, r.Queries, owner, "Co Lead Withdraw Project")
	withdrawable := createWorkflowApplication(t, ctx, r.Pool, project2.ID, team.ID, coLead.ID, string(model.ApplicationStatusSubmitted))
	if _, err := mutation.WithdrawApplication(auth.WithUser(ctx, coLead), uuidString(withdrawable)); err != nil {
		t.Fatalf("WithdrawApplication as co-lead: %v", err)
	}
	_, err = mutation.ArchiveTeam(auth.WithUser(ctx, coLead), uuidString(team.ID), nil)
	assertErrorContains(t, err, "team lead access required")
}

func TestTeamJoinRequestsRequiresLeadAndFilters(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	coLead := createWorkflowUser(t, ctx, r.Queries, "co_lead", true)
	member := createWorkflowUser(t, ctx, r.Queries, "member", true)
	requester1 := createWorkflowUser(t, ctx, r.Queries, "requester1", true)
	requester2 := createWorkflowUser(t, ctx, r.Queries, "requester2", true)
	requester3 := createWorkflowUser(t, ctx, r.Queries, "requester3", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Join Requests Team")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: coLead.ID, Role: string(model.TeamRoleCoLead)}); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: member.ID, Role: string(model.TeamRoleMember)}); err != nil {
		t.Fatal(err)
	}

	mutation := &mutationResolver{r}
	pendingRequest, err := mutation.RequestJoin(auth.WithUser(ctx, requester1), uuidString(team.ID), textStringPointer("Interested in joining."))
	if err != nil {
		t.Fatal(err)
	}
	rejectedRequest, err := mutation.RequestJoin(auth.WithUser(ctx, requester2), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	acceptedRequest, err := mutation.RequestJoin(auth.WithUser(ctx, requester3), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.Pool.Exec(ctx, `UPDATE team_join_requests SET status = 'REJECTED' WHERE id = $1`, rejectedRequest.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Pool.Exec(ctx, `UPDATE team_join_requests SET status = 'ACCEPTED_PENDING_CONFIRMATION' WHERE id = $1`, acceptedRequest.ID); err != nil {
		t.Fatal(err)
	}

	query := &queryResolver{r}
	_, err = query.TeamJoinRequests(auth.WithUser(ctx, member), uuidString(team.ID), nil)
	assertErrorContains(t, err, "team lead access required")

	status := model.JoinRequestStatusPending
	pending, err := query.TeamJoinRequests(auth.WithUser(ctx, coLead), uuidString(team.ID), &status)
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 1 || pending[0].ID != pendingRequest.ID {
		t.Fatalf("pending requests = %v, want only %s", requestIDs(pending), pendingRequest.ID)
	}

	all, err := query.TeamJoinRequests(auth.WithUser(ctx, lead), uuidString(team.ID), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 3 {
		t.Fatalf("all requests count = %d, want 3", len(all))
	}

	acceptedStatus := model.JoinRequestStatusAcceptedPendingConfirmation
	selfRequests, err := query.MyJoinRequests(auth.WithUser(ctx, requester3), &acceptedStatus)
	if err != nil {
		t.Fatal(err)
	}
	if len(selfRequests) != 1 || selfRequests[0].ID != acceptedRequest.ID {
		t.Fatalf("self accepted requests = %v, want only %s", requestIDs(selfRequests), acceptedRequest.ID)
	}
}

func TestPermissionFlagsReflectCurrentUser(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	coLead := createWorkflowUser(t, ctx, r.Queries, "co_lead", true)
	member := createWorkflowUser(t, ctx, r.Queries, "member", true)
	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	admin := createWorkflowUser(t, ctx, r.Queries, "admin", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Permissions Team")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: coLead.ID, Role: string(model.TeamRoleCoLead)}); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: member.ID, Role: string(model.TeamRoleMember)}); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Pool.Exec(ctx, `INSERT INTO admin_users (user_id) VALUES ($1)`, admin.ID); err != nil {
		t.Fatal(err)
	}
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Permissions Project")

	leadTeam, err := r.team(auth.WithUser(ctx, lead), team)
	if err != nil {
		t.Fatal(err)
	}
	if !leadTeam.Permissions.CanEdit || !leadTeam.Permissions.CanManageMembers || !leadTeam.Permissions.CanInviteMembers || !leadTeam.Permissions.CanArchive || !leadTeam.Permissions.CanApplyToProjects {
		t.Fatalf("lead team permissions = %+v, want all true", leadTeam.Permissions)
	}
	coLeadTeam, err := r.team(auth.WithUser(ctx, coLead), team)
	if err != nil {
		t.Fatal(err)
	}
	if !coLeadTeam.Permissions.CanEdit || !coLeadTeam.Permissions.CanManageMembers || !coLeadTeam.Permissions.CanInviteMembers || coLeadTeam.Permissions.CanArchive || !coLeadTeam.Permissions.CanApplyToProjects {
		t.Fatalf("co-lead team permissions = %+v, want lead-like except archive", coLeadTeam.Permissions)
	}
	memberTeam, err := r.team(auth.WithUser(ctx, member), team)
	if err != nil {
		t.Fatal(err)
	}
	if memberTeam.Permissions.CanEdit || memberTeam.Permissions.CanManageMembers || memberTeam.Permissions.CanInviteMembers || memberTeam.Permissions.CanArchive || memberTeam.Permissions.CanApplyToProjects {
		t.Fatalf("member team permissions = %+v, want all false", memberTeam.Permissions)
	}

	ownerProject, err := r.project(auth.WithUser(ctx, owner), project)
	if err != nil {
		t.Fatal(err)
	}
	if !ownerProject.Permissions.CanEdit || !ownerProject.Permissions.CanReviewApplications || !ownerProject.Permissions.CanSubmitForApproval || !ownerProject.Permissions.CanArchive || ownerProject.Permissions.CanApprove {
		t.Fatalf("owner project permissions = %+v, want owner actions true and approve false", ownerProject.Permissions)
	}
	adminProject, err := r.project(auth.WithUser(ctx, admin), project)
	if err != nil {
		t.Fatal(err)
	}
	if adminProject.Permissions.CanEdit || adminProject.Permissions.CanReviewApplications || adminProject.Permissions.CanSubmitForApproval || adminProject.Permissions.CanArchive || !adminProject.Permissions.CanApprove {
		t.Fatalf("admin project permissions = %+v, want approve only", adminProject.Permissions)
	}
}

func TestProjectApplicationHydratesFrontendReviewFields(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "owner", true)
	lead := createWorkflowUser(t, ctx, r.Queries, "lead", true)
	member := createWorkflowUser(t, ctx, r.Queries, "member", true)
	team := createWorkflowTeam(t, ctx, r.Queries, lead, "Hydration Team")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: member.ID, Role: string(model.TeamRoleMember)}); err != nil {
		t.Fatal(err)
	}
	project := createWorkflowProject(t, ctx, r.Queries, owner, "Hydration Project")
	applicationID := createWorkflowApplication(t, ctx, r.Pool, project.ID, team.ID, lead.ID, string(model.ApplicationStatusOfferSent))
	if _, err := r.Pool.Exec(ctx, `
UPDATE project_applications
SET message = 'Application message',
    answers = '{"ok": true}'::jsonb,
    review_message = 'Review message',
    offer_message = 'Offer message',
    expires_at = now() + interval '1 hour'
WHERE id = $1`, applicationID); err != nil {
		t.Fatal(err)
	}

	mapped, err := r.project(auth.WithUser(ctx, owner), project)
	if err != nil {
		t.Fatal(err)
	}
	if len(mapped.Applications) != 1 {
		t.Fatalf("application count = %d, want 1", len(mapped.Applications))
	}
	application := mapped.Applications[0]
	if application.Applicant == nil || application.Applicant.ID != uuidString(lead.ID) {
		t.Fatalf("applicant = %+v, want lead", application.Applicant)
	}
	if application.Message == nil || *application.Message != "Application message" {
		t.Fatalf("message = %v, want Application message", application.Message)
	}
	if !strings.Contains(application.Answers, `"ok"`) {
		t.Fatalf("answers = %q, want ok JSON", application.Answers)
	}
	if application.ReviewMessage == nil || *application.ReviewMessage != "Review message" {
		t.Fatalf("review message = %v, want Review message", application.ReviewMessage)
	}
	if application.OfferMessage == nil || *application.OfferMessage != "Offer message" {
		t.Fatalf("offer message = %v, want Offer message", application.OfferMessage)
	}
	if application.ExpiresAt == nil {
		t.Fatal("expiresAt = nil, want timestamp")
	}
	if len(application.Team.Members) != 2 {
		t.Fatalf("application team member count = %d, want 2", len(application.Team.Members))
	}
}

func workflowTestResolver(t *testing.T) (context.Context, *Resolver, func()) {
	t.Helper()
	dsn := os.Getenv("QUORUM_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("QUORUM_TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	prefix := "wf_" + strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000"), ".", "_") + "_"
	cleanup := func() {
		_, _ = pool.Exec(ctx, `
DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE username LIKE $1);
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1);
DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE username LIKE $1) OR receiver_id IN (SELECT id FROM users WHERE username LIKE $1);
DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE username LIKE $1);
DELETE FROM teams WHERE created_by IN (SELECT id FROM users WHERE username LIKE $1);
DELETE FROM users WHERE username LIKE $1;`, prefix+"%")
		pool.Close()
	}
	return context.WithValue(ctx, workflowPrefixKey{}, prefix), &Resolver{Pool: pool, Queries: db.New(pool)}, cleanup
}

type workflowPrefixKey struct{}

func workflowPrefix(ctx context.Context) string {
	prefix, _ := ctx.Value(workflowPrefixKey{}).(string)
	return prefix
}

func createWorkflowUser(t *testing.T, ctx context.Context, q *db.Queries, label string, complete bool) db.User {
	t.Helper()
	username := workflowPrefix(ctx) + label
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		AuthUserID: username + "_auth",
		Username:   username,
		Email:      textString(username + "@example.com"),
		FullName:   "Workflow " + label,
		Discipline: textString("SOEN"),
		University: textString("Concordia"),
		Bio:        textString("Workflow test user."),
		UserIntent: "STUDENT",
	})
	if err != nil {
		t.Fatal(err)
	}
	user, err = q.UpdateProfile(ctx, db.UpdateProfileParams{
		ID:                    user.ID,
		FullName:              user.FullName,
		Bio:                   textString("Workflow test user."),
		Discipline:            textString("SOEN"),
		University:            textString("Concordia"),
		UserIntent:            "STUDENT",
		ResumeVisibility:      string(model.ResumeVisibilityPrivate),
		PreferredProjectAreas: []string{},
		ProfileComplete:       complete,
	})
	if err != nil {
		t.Fatal(err)
	}
	return user
}

func createWorkflowTeam(t *testing.T, ctx context.Context, q *db.Queries, lead db.User, name string) db.Team {
	t.Helper()
	team, err := q.CreateTeam(ctx, db.CreateTeamParams{
		Name:             workflowPrefix(ctx) + name,
		Description:      textString("Workflow test team."),
		Discipline:       textString("SOEN"),
		MaxSize:          6,
		CreatedBy:        lead.ID,
		RecruitingState:  string(model.TeamRecruitingStateRecruiting),
		Visibility:       string(model.TeamVisibilityVisible),
		ExistingSkills:   []string{},
		NeededSkills:     []string{},
		ProjectInterests: []string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.AddTeamMember(ctx, db.AddTeamMemberParams{TeamID: team.ID, UserID: lead.ID, Role: string(model.TeamRoleLead)}); err != nil {
		t.Fatal(err)
	}
	return team
}

func createWorkflowProject(t *testing.T, ctx context.Context, q *db.Queries, owner db.User, title string) db.Project {
	t.Helper()
	project, err := q.CreateProject(ctx, db.CreateProjectParams{
		Title:                workflowPrefix(ctx) + title,
		Summary:              "Workflow test project.",
		Description:          "Workflow test project.",
		Disciplines:          []string{"SOEN"},
		TeamSizeMin:          1,
		TeamSizeMax:          6,
		OwnerID:              owner.ID,
		LifecycleState:       string(model.ProjectLifecycleStateOpen),
		ApprovalState:        string(model.ProjectApprovalStateUnverified),
		RequiredSkills:       []string{"Go"},
		NiceToHaveSkills:     []string{},
		ExternalResources:    []string{},
		ApplicationQuestions: []byte("[]"),
	})
	if err != nil {
		t.Fatal(err)
	}
	return project
}

func createWorkflowApplicationForProject(t *testing.T, ctx context.Context, pool *pgxpool.Pool, ownerProjectID, teamID, applicantID pgtype.UUID, status string, projectTitle string) pgtype.UUID {
	t.Helper()
	_ = ownerProjectID
	var ownerID pgtype.UUID
	if err := pool.QueryRow(ctx, `SELECT owner_id FROM projects WHERE id = $1`, ownerProjectID).Scan(&ownerID); err != nil {
		t.Fatal(err)
	}
	var projectID pgtype.UUID
	if err := pool.QueryRow(ctx, `
INSERT INTO projects (title, summary, description, disciplines, team_size_min, team_size_max, owner_id, lifecycle_state, approval_state, required_skills, nice_to_have_skills, external_resources, application_questions)
VALUES ($1, 'Workflow test project.', 'Workflow test project.', ARRAY['SOEN'], 1, 6, $2, 'OPEN', 'UNVERIFIED', ARRAY['Go'], ARRAY[]::text[], ARRAY[]::text[], '[]'::jsonb)
RETURNING id`, workflowPrefix(ctx)+projectTitle, ownerID).Scan(&projectID); err != nil {
		t.Fatal(err)
	}
	return createWorkflowApplication(t, ctx, pool, projectID, teamID, applicantID, status)
}

func createWorkflowApplication(t *testing.T, ctx context.Context, pool *pgxpool.Pool, projectID, teamID, applicantID pgtype.UUID, status string) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	if err := pool.QueryRow(ctx, `
INSERT INTO project_applications (project_id, team_id, applicant_id, answers, status, expires_at)
VALUES ($1, $2, $3, '[]'::jsonb, $4, now() + interval '1 hour')
RETURNING id`, projectID, teamID, applicantID, status).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func createExpiredWorkflowApplication(t *testing.T, ctx context.Context, pool *pgxpool.Pool, projectID, teamID, applicantID pgtype.UUID, status string) pgtype.UUID {
	t.Helper()
	var id pgtype.UUID
	if err := pool.QueryRow(ctx, `
INSERT INTO project_applications (project_id, team_id, applicant_id, answers, status, expires_at)
VALUES ($1, $2, $3, '[]'::jsonb, $4, now() - interval '1 hour')
RETURNING id`, projectID, teamID, applicantID, status).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func assertApplicationStatus(t *testing.T, ctx context.Context, q *db.Queries, id pgtype.UUID, want string) {
	t.Helper()
	app, err := q.GetProjectApplication(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if app.Status != want {
		t.Fatal(errors.New(fmt.Sprintf("application %s status = %s, want %s", uuidString(id), app.Status, want)))
	}
}

func assertTeamAndProjectNotMatched(t *testing.T, ctx context.Context, q *db.Queries, teamID, projectID pgtype.UUID) {
	t.Helper()
	team, err := q.GetTeam(ctx, teamID)
	if err != nil {
		t.Fatal(err)
	}
	if team.CapstoneState == string(model.TeamCapstoneStateMatched) {
		t.Fatalf("team capstone state = MATCHED, want not matched")
	}
	project, err := q.GetProject(ctx, projectID)
	if err != nil {
		t.Fatal(err)
	}
	if project.LifecycleState == string(model.ProjectLifecycleStateMatched) || sameUUID(project.TeamID, teamID) {
		t.Fatalf("project state = %s team=%s, want not matched", project.LifecycleState, uuidString(project.TeamID))
	}
}

func assertErrorContains(t *testing.T, err error, want string) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), want) {
		t.Fatalf("error = %v, want %q", err, want)
	}
}

func textStringPointer(value string) *string {
	return &value
}

func requestIDs(requests []*model.TeamJoinRequest) []string {
	out := make([]string, 0, len(requests))
	for _, request := range requests {
		out = append(out, request.ID)
	}
	return out
}

func tagNames(tags []*model.Tag) string {
	names := make([]string, 0, len(tags))
	for _, tag := range tags {
		names = append(names, tag.Name)
	}
	return strings.Join(names, ",")
}
