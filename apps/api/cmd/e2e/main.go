package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/config"
	apiserver "github.com/local/quorum/apps/api/internal/server"
)

type authUser struct {
	Label    string `json:"label"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
	Token    string `json:"token"`
	UserID   string `json:"userId"`
}

type graphResponse struct {
	Data   map[string]any `json:"data"`
	Errors []graphQLError `json:"errors"`
}

type graphQLError struct {
	Message string `json:"message"`
}

type runner struct {
	cfg       config.Config
	client    *http.Client
	apiURL    string
	apiMode   string
	authBase  string
	origin    string
	failures  []string
	tokenFile string
}

func main() {
	var apiURL string
	var runID string
	flag.StringVar(&apiURL, "api", "", "GraphQL API URL; leave empty to run an in-process server")
	flag.StringVar(&runID, "run-id", time.Now().UTC().Format("20060102T150405Z"), "unique run id")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fatal("load config", err)
	}
	if strings.TrimSpace(cfg.NeonAuthJWKSURL) == "" {
		fatal("config", errors.New("NEON_AUTH_JWKS_URL is required"))
	}

	authBase := strings.TrimSuffix(cfg.NeonAuthJWKSURL, "/.well-known/jwks.json")
	if authBase == cfg.NeonAuthJWKSURL {
		fatal("config", fmt.Errorf("NEON_AUTH_JWKS_URL has unexpected shape: %s", cfg.NeonAuthJWKSURL))
	}

	var pool *pgxpool.Pool
	var testServer *httptest.Server
	apiMode := "external"
	if strings.TrimSpace(apiURL) == "" {
		pool, err = pgxpool.New(context.Background(), cfg.DatabaseURL)
		if err != nil {
			fatal("database pool", err)
		}
		defer pool.Close()

		logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
		testServer = httptest.NewServer(apiserver.NewHandler(cfg, pool, logger))
		defer testServer.Close()
		apiURL = testServer.URL + "/graphql"
		apiMode = "in-process"
	}

	r := &runner{
		cfg:      cfg,
		client:   &http.Client{Timeout: 15 * time.Second},
		apiURL:   apiURL,
		apiMode:  apiMode,
		authBase: authBase,
		origin:   cfg.AppOrigin,
	}

	if err := r.run(context.Background(), runID); err != nil {
		fatal("e2e", err)
	}
}

func (r *runner) run(ctx context.Context, runID string) error {
	admin := &authUser{
		Label:    "qa_admin_lead",
		Email:    fmt.Sprintf("qa_admin_lead_%s@example.com", strings.ToLower(runID)),
		Password: "QuorumE2E!20260602",
		Username: "qa_admin_lead_" + strings.ToLower(runID),
	}
	owner := &authUser{
		Label:    "qa_project_owner",
		Email:    fmt.Sprintf("qa_project_owner_%s@example.com", strings.ToLower(runID)),
		Password: "QuorumE2E!20260602",
		Username: "qa_project_owner_" + strings.ToLower(runID),
	}
	invitee := &authUser{
		Label:    "qa_invited_student",
		Email:    fmt.Sprintf("qa_invited_student_%s@example.com", strings.ToLower(runID)),
		Password: "QuorumE2E!20260602",
		Username: "qa_invited_student_" + strings.ToLower(runID),
	}
	requester := &authUser{
		Label:    "qa_join_requester",
		Email:    fmt.Sprintf("qa_join_requester_%s@example.com", strings.ToLower(runID)),
		Password: "QuorumE2E!20260602",
		Username: "qa_join_requester_" + strings.ToLower(runID),
	}

	r.step("healthz", func() error {
		healthURL := strings.TrimSuffix(strings.TrimSuffix(r.apiURL, "/graphql"), "/") + "/healthz"
		var payload map[string]any
		return r.getJSON(ctx, healthURL, &payload, func(status int) error {
			if status != http.StatusOK {
				return fmt.Errorf("status %d", status)
			}
			if payload["database"] != "ok" {
				return fmt.Errorf("database = %v, want ok", payload["database"])
			}
			return nil
		})
	})

	r.step("public teams/projects", func() error {
		resp, err := r.graphql(ctx, "", "query Public { teams { id name } projects { id title status } }", nil)
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if len(asSlice(resp.Data["teams"])) == 0 || len(asSlice(resp.Data["projects"])) == 0 {
			return errors.New("expected seeded teams and projects")
		}
		return nil
	})

	for _, user := range []*authUser{admin, owner, invitee, requester} {
		r.step(user.Label+" Neon Auth signup/token", func() error {
			return r.createAuthUser(ctx, user)
		})
		r.step(user.Label+" me before bootstrap requires profile", func() error {
			resp, err := r.graphql(ctx, user.Token, "query Me { me { id username } }", nil)
			if err != nil {
				return err
			}
			if err := expectNoGraphErrors(resp); err == nil {
				me := asMap(resp.Data["me"])
				if me["id"] != nil {
					user.UserID = fmt.Sprint(me["id"])
				}
				return nil
			}
			return expectGraphError(resp, "authentication required")
		})
		r.step(user.Label+" bootstrap profile", func() error {
			resp, err := r.graphql(ctx, user.Token, `
mutation Bootstrap($input: BootstrapProfileInput!) {
  bootstrapProfile(input: $input) { id username email fullName discipline university profileComplete }
}`, map[string]any{"input": map[string]any{
				"username":   user.Username,
				"email":      user.Email,
				"fullName":   strings.ReplaceAll(title(user.Label), "_", " "),
				"discipline": "SOEN",
				"university": "Concordia",
				"bio":        "Automated E2E validation profile.",
			}})
			if err != nil {
				return err
			}
			if err := expectNoGraphErrors(resp); err != nil {
				return err
			}
			created := asMap(resp.Data["bootstrapProfile"])
			user.UserID = fmt.Sprint(created["id"])
			if created["username"] != user.Username {
				return fmt.Errorf("username = %v, want %s", created["username"], user.Username)
			}
			return nil
		})
		r.step(user.Label+" complete profile gate", func() error {
			resp, err := r.graphql(ctx, user.Token, `
mutation CompleteProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) { id username profileComplete }
}`, map[string]any{"input": map[string]any{
				"fullName":              strings.ReplaceAll(title(user.Label), "_", " "),
				"bio":                   "Automated E2E validation profile.",
				"discipline":            "SOEN",
				"university":            "Concordia",
				"preferredProjectAreas": []string{"Distributed systems", "Product engineering"},
			}})
			if err != nil {
				return err
			}
			if err := expectNoGraphErrors(resp); err != nil {
				return err
			}
			updated := asMap(resp.Data["updateProfile"])
			if updated["profileComplete"] != true {
				return fmt.Errorf("profileComplete = %v, want true", updated["profileComplete"])
			}
			return nil
		})
		r.step(user.Label+" me after bootstrap", func() error {
			resp, err := r.graphql(ctx, user.Token, "query Me { me { id username } }", nil)
			if err != nil {
				return err
			}
			if err := expectNoGraphErrors(resp); err != nil {
				return err
			}
			if asMap(resp.Data["me"])["username"] != user.Username {
				return fmt.Errorf("me username mismatch: %v", resp.Data["me"])
			}
			return nil
		})
	}

	r.step("grant admin", func() error {
		conn, err := pgx.Connect(ctx, r.cfg.DatabaseURL)
		if err != nil {
			return err
		}
		defer conn.Close(ctx)
		_, err = conn.Exec(ctx, `
INSERT INTO admin_users (user_id) VALUES ($1)
ON CONFLICT DO NOTHING`, admin.UserID)
		return err
	})

	r.step("admin set universal deadline", func() error {
		deadline := time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339)
		resp, err := r.graphql(ctx, admin.Token, `
mutation SetDeadline($deadlineAt: String!, $reason: String) {
  setUniversalDeadline(deadlineAt: $deadlineAt, reason: $reason) { id deadlineAt updatedAt }
}`, map[string]any{"deadlineAt": deadline, "reason": "Automated E2E validation window."})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if asMap(resp.Data["setUniversalDeadline"])["id"] != "capstone_match" {
			return fmt.Errorf("deadline response = %v", resp.Data["setUniversalDeadline"])
		}
		return nil
	})

	var teamID string
	r.step("admin createTeam", func() error {
		teamName := "E2E Team " + runID
		resp, err := r.graphql(ctx, admin.Token, `
mutation CreateTeam($input: CreateTeamInput!) {
  createTeam(input: $input) { id name members { role user { username } } }
}`, map[string]any{"input": map[string]any{
			"name":        teamName,
			"description": "Created by automated Neon E2E validation.",
			"discipline":  "SOEN",
			"maxSize":     12,
		}})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			if !graphHasError(resp, "you are already on a team") {
				return err
			}
			teamID, err = r.findPublicID(ctx, "teams", "name", teamName)
			return err
		}
		teamID = fmt.Sprint(asMap(resp.Data["createTeam"])["id"])
		return requireNonEmpty("team id", teamID)
	})

	r.step("team invitation accept flow", func() error {
		resp, err := r.graphql(ctx, admin.Token, `
mutation Invite($teamId: ID!, $userId: ID!, $message: String) {
  inviteTeamMember(teamId: $teamId, userId: $userId, message: $message) { id status invitedUser { username } }
}`, map[string]any{"teamId": teamID, "userId": invitee.UserID, "message": "Join the automated smoke-test team."})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		invitationID := fmt.Sprint(asMap(resp.Data["inviteTeamMember"])["id"])
		if err := requireNonEmpty("invitation id", invitationID); err != nil {
			return err
		}

		resp, err = r.graphql(ctx, invitee.Token, `
mutation AcceptInvitation($invitationId: ID!) {
  respondToTeamInvitation(invitationId: $invitationId, accept: true) { id status team { id members { user { username } } } }
}`, map[string]any{"invitationId": invitationID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		accepted := asMap(resp.Data["respondToTeamInvitation"])
		if accepted["status"] != "ACCEPTED" {
			return fmt.Errorf("invitation status = %v, want ACCEPTED", accepted["status"])
		}
		return nil
	})

	r.step("join request confirmation flow", func() error {
		resp, err := r.graphql(ctx, requester.Token, `
mutation RequestJoin($teamId: ID!, $message: String) {
  requestJoin(teamId: $teamId, message: $message) { id status user { username } }
}`, map[string]any{"teamId": teamID, "message": "Requesting to join from automated smoke test."})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		requestID := fmt.Sprint(asMap(resp.Data["requestJoin"])["id"])
		if err := requireNonEmpty("join request id", requestID); err != nil {
			return err
		}

		resp, err = r.graphql(ctx, admin.Token, `
mutation ReviewJoinRequest($requestId: ID!) {
  respondToJoinRequest(requestId: $requestId, accept: true) { id status }
}`, map[string]any{"requestId": requestID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if asMap(resp.Data["respondToJoinRequest"])["status"] != "ACCEPTED_PENDING_CONFIRMATION" {
			return fmt.Errorf("join request review = %v", resp.Data["respondToJoinRequest"])
		}

		resp, err = r.graphql(ctx, requester.Token, `
mutation ConfirmJoinRequest($requestId: ID!) {
  confirmJoinRequest(requestId: $requestId) { id status team { id members { user { username } } } }
}`, map[string]any{"requestId": requestID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if asMap(resp.Data["confirmJoinRequest"])["status"] != "CONFIRMED" {
			return fmt.Errorf("join request confirmation = %v", resp.Data["confirmJoinRequest"])
		}
		return nil
	})

	var projectID string
	r.step("owner createProject", func() error {
		projectTitle := "E2E Project " + runID
		resp, err := r.graphql(ctx, owner.Token, `
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) { id title status owner { username } }
}`, map[string]any{"input": map[string]any{
			"title":       projectTitle,
			"description": "Created by automated Neon E2E validation.",
			"constraints": "Use the validation branch only.",
			"disciplines": []string{"SOEN", "ELEC"},
			"teamSizeMin": 2,
			"teamSizeMax": 6,
		}})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			if !graphHasError(resp, "users may own only one project in v1") {
				return err
			}
			projectID, err = r.findPublicID(ctx, "projects", "title", projectTitle)
			return err
		}
		projectID = fmt.Sprint(asMap(resp.Data["createProject"])["id"])
		return requireNonEmpty("project id", projectID)
	})

	var applicationID string
	r.step("admin applyToProject", func() error {
		resp, err := r.graphql(ctx, admin.Token, `
mutation Apply($projectId: ID!, $teamId: ID!) {
  applyToProject(projectId: $projectId, teamId: $teamId, message: "Automated E2E application") {
    id status team { id } project { id }
  }
}`, map[string]any{"projectId": projectID, "teamId": teamID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		applicationID = fmt.Sprint(asMap(resp.Data["applyToProject"])["id"])
		return requireNonEmpty("application id", applicationID)
	})

	r.step("project offer confirmation flow", func() error {
		resp, err := r.graphql(ctx, owner.Token, `
mutation SendOffer($applicationId: ID!, $message: String) {
  sendProjectOffer(applicationId: $applicationId, message: $message) { id status expiresAt }
}`, map[string]any{"applicationId": applicationID, "message": "Automated E2E match offer."})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if asMap(resp.Data["sendProjectOffer"])["status"] != "OFFER_SENT" {
			return fmt.Errorf("offer status = %v", resp.Data["sendProjectOffer"])
		}

		resp, err = r.graphql(ctx, admin.Token, `
mutation ConfirmByTeam($applicationId: ID!) {
  confirmProjectOfferByTeam(applicationId: $applicationId) { id status teamConfirmedAt }
}`, map[string]any{"applicationId": applicationID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if asMap(resp.Data["confirmProjectOfferByTeam"])["status"] != "TEAM_CONFIRMED" {
			return fmt.Errorf("team confirmation = %v", resp.Data["confirmProjectOfferByTeam"])
		}

		resp, err = r.graphql(ctx, owner.Token, `
mutation ConfirmByOwner($applicationId: ID!) {
  confirmProjectOfferByOwner(applicationId: $applicationId) { id status ownerConfirmedAt project { lifecycleState team { id } } }
}`, map[string]any{"applicationId": applicationID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if asMap(resp.Data["confirmProjectOfferByOwner"])["status"] != "MATCHED" {
			return fmt.Errorf("owner confirmation = %v", resp.Data["confirmProjectOfferByOwner"])
		}
		return nil
	})

	var adminToOwnerMsgID string
	r.step("sendMessage both directions", func() error {
		resp, err := r.graphql(ctx, admin.Token, `
mutation Send($receiverId: ID!, $body: String!) {
  sendMessage(receiverId: $receiverId, body: $body) { id read sender { username } receiver { username } }
}`, map[string]any{"receiverId": owner.UserID, "body": "Admin to owner E2E message"})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		adminToOwnerMsgID = fmt.Sprint(asMap(resp.Data["sendMessage"])["id"])

		resp, err = r.graphql(ctx, owner.Token, `
mutation Send($receiverId: ID!, $body: String!) {
  sendMessage(receiverId: $receiverId, body: $body) { id read sender { username } receiver { username } }
}`, map[string]any{"receiverId": admin.UserID, "body": "Owner to admin E2E message"})
		if err != nil {
			return err
		}
		return expectNoGraphErrors(resp)
	})

	r.step("myInbox and myMessages", func() error {
		resp, err := r.graphql(ctx, owner.Token, "query Inbox { myInbox { id username } }", nil)
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if len(asSlice(resp.Data["myInbox"])) == 0 {
			return errors.New("owner inbox is empty")
		}

		resp, err = r.graphql(ctx, owner.Token, `
query Messages($withUser: ID!) {
  myMessages(withUser: $withUser) { id body read sender { username } receiver { username } }
}`, map[string]any{"withUser": admin.UserID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if len(asSlice(resp.Data["myMessages"])) < 2 {
			return fmt.Errorf("myMessages count = %d, want at least 2", len(asSlice(resp.Data["myMessages"])))
		}
		return nil
	})

	r.step("markRead", func() error {
		resp, err := r.graphql(ctx, owner.Token, `
mutation MarkRead($id: ID!) { markRead(messageId: $id) }
`, map[string]any{"id": adminToOwnerMsgID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if resp.Data["markRead"] != true {
			return fmt.Errorf("markRead = %v, want true", resp.Data["markRead"])
		}
		return nil
	})

	var notificationID string
	r.step("seed current-user notification", func() error {
		conn, err := pgx.Connect(ctx, r.cfg.DatabaseURL)
		if err != nil {
			return err
		}
		defer conn.Close(ctx)
		return conn.QueryRow(ctx, `
INSERT INTO notifications (user_id, type, payload)
VALUES ($1, 'E2E', '{"source":"e2e"}'::jsonb)
RETURNING id`, admin.UserID).Scan(&notificationID)
	})

	r.step("myNotifications and markNotificationRead", func() error {
		resp, err := r.graphql(ctx, admin.Token, "query Notifications { myNotifications { id type read payload } }", nil)
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if len(asSlice(resp.Data["myNotifications"])) == 0 {
			return errors.New("admin notifications are empty")
		}
		resp, err = r.graphql(ctx, admin.Token, `
mutation MarkNotification($id: ID!) { markNotificationRead(notificationId: $id) }
`, map[string]any{"id": notificationID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if resp.Data["markNotificationRead"] != true {
			return fmt.Errorf("markNotificationRead = %v, want true", resp.Data["markNotificationRead"])
		}
		return nil
	})

	r.step("non-admin removeTeam rejected", func() error {
		resp, err := r.graphql(ctx, owner.Token, `mutation Remove($teamId: ID!) { removeTeam(teamId: $teamId) }`, map[string]any{"teamId": teamID})
		if err != nil {
			return err
		}
		return expectGraphError(resp, "admin access required")
	})

	r.step("admin audit logs include workflow activity", func() error {
		resp, err := r.graphql(ctx, admin.Token, `
query AuditLogs {
  auditLogs(limit: 50) { id actionType targetEntityType reason createdAt }
  universalDeadline { id deadlineAt updatedAt }
}`, nil)
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		logs := asSlice(resp.Data["auditLogs"])
		if len(logs) == 0 {
			return errors.New("audit logs are empty")
		}
		want := map[string]bool{
			"UNIVERSAL_DEADLINE_CHANGED":   false,
			"TEAM_INVITATION_CREATED":      false,
			"JOIN_REQUEST_CREATED":         false,
			"PROJECT_OFFER_TEAM_CONFIRMED": false,
			"PROJECT_MATCH_FINALIZED":      false,
		}
		for _, item := range logs {
			action := fmt.Sprint(asMap(item)["actionType"])
			if _, ok := want[action]; ok {
				want[action] = true
			}
		}
		for action, found := range want {
			if !found {
				return fmt.Errorf("missing audit action %s", action)
			}
		}
		if asMap(resp.Data["universalDeadline"])["id"] != "capstone_match" {
			return fmt.Errorf("universal deadline missing: %v", resp.Data["universalDeadline"])
		}
		return nil
	})

	var disposableProjectID string
	r.step("admin removal against disposable project", func() error {
		resp, err := r.graphql(ctx, admin.Token, `
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) { id title }
}`, map[string]any{"input": map[string]any{
			"title":       "E2E Disposable " + runID,
			"description": "Safe admin deletion target.",
			"constraints": "Delete through admin mutation.",
			"disciplines": []string{"SOEN"},
			"teamSizeMin": 1,
			"teamSizeMax": 2,
		}})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		disposableProjectID = fmt.Sprint(asMap(resp.Data["createProject"])["id"])
		resp, err = r.graphql(ctx, admin.Token, `mutation Remove($projectId: ID!) { removeProject(projectId: $projectId) }`, map[string]any{"projectId": disposableProjectID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if resp.Data["removeProject"] != true {
			return fmt.Errorf("removeProject = %v, want true", resp.Data["removeProject"])
		}

		resp, err = r.graphql(ctx, "", `query Project($id: ID!) { project(id: $id) { id title } }`, map[string]any{"id": disposableProjectID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if resp.Data["project"] != nil {
			return fmt.Errorf("disposable project still exists: %v", resp.Data["project"])
		}
		return nil
	})

	r.step("public lists include new records", func() error {
		resp, err := r.graphql(ctx, "", `query Lists($teamSearch: String, $projectSearch: String) {
  teams(search: $teamSearch) { id name }
  projects(search: $projectSearch) { id title }
}`, map[string]any{"teamSearch": "E2E Team " + runID, "projectSearch": "E2E Project " + runID})
		if err != nil {
			return err
		}
		if err := expectNoGraphErrors(resp); err != nil {
			return err
		}
		if len(asSlice(resp.Data["teams"])) == 0 || len(asSlice(resp.Data["projects"])) == 0 {
			return fmt.Errorf("new public records missing: %v", resp.Data)
		}
		return nil
	})

	if err := r.writeTokens(runID, admin, owner, invitee, requester); err != nil {
		r.failures = append(r.failures, "write token artifact: "+err.Error())
	}

	if len(r.failures) > 0 {
		for _, failure := range r.failures {
			fmt.Println("FAIL", failure)
		}
		return fmt.Errorf("%d validation step(s) failed", len(r.failures))
	}

	fmt.Println("PASS backend Neon E2E validation")
	fmt.Println("token artifact:", r.tokenFile)
	return nil
}

func (r *runner) step(name string, fn func() error) {
	start := time.Now()
	if err := fn(); err != nil {
		fmt.Printf("FAIL %-44s %s\n", name, err)
		r.failures = append(r.failures, name+": "+err.Error())
		return
	}
	fmt.Printf("PASS %-44s %s\n", name, time.Since(start).Round(time.Millisecond))
}

func (r *runner) createAuthUser(ctx context.Context, user *authUser) error {
	body := map[string]any{
		"email":       user.Email,
		"password":    user.Password,
		"name":        strings.ReplaceAll(title(user.Label), "_", " "),
		"callbackURL": r.origin,
	}
	resp, raw, err := r.postJSON(ctx, r.authBase+"/sign-up/email", "", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusConflict || resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnprocessableEntity {
		resp, raw, err = r.postJSON(ctx, r.authBase+"/sign-in/email", "", map[string]any{
			"email":       user.Email,
			"password":    user.Password,
			"callbackURL": r.origin,
		})
		if err != nil {
			return err
		}
		defer resp.Body.Close()
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("auth signup/signin status %d: %s", resp.StatusCode, raw)
	}
	cookie := sessionCookie(resp.Header.Values("Set-Cookie"))
	if cookie == "" {
		return errors.New("Neon Auth response did not set a signed session cookie")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, r.authBase+"/token", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Origin", r.origin)
	req.Header.Set("Cookie", cookie)
	tokenResp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer tokenResp.Body.Close()
	tokenBody, err := io.ReadAll(tokenResp.Body)
	if err != nil {
		return err
	}
	if tokenResp.StatusCode != http.StatusOK {
		return fmt.Errorf("token status %d: %s", tokenResp.StatusCode, string(tokenBody))
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(tokenBody, &payload); err != nil {
		return err
	}
	if strings.Count(payload.Token, ".") != 2 {
		return errors.New("token route did not return a JWT")
	}
	user.Token = payload.Token
	return nil
}

func (r *runner) graphql(ctx context.Context, token string, query string, variables map[string]any) (*graphResponse, error) {
	body := map[string]any{"query": query}
	if variables != nil {
		body["variables"] = variables
	}
	resp, raw, err := r.postJSON(ctx, r.apiURL, token, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("graphql http status %d: %s", resp.StatusCode, raw)
	}
	var out graphResponse
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return nil, fmt.Errorf("decode graphql: %w: %s", err, raw)
	}
	return &out, nil
}

func (r *runner) postJSON(ctx context.Context, url string, token string, body any) (*http.Response, string, error) {
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(encoded))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", r.origin)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		_ = resp.Body.Close()
		return nil, "", err
	}
	resp.Body = io.NopCloser(bytes.NewReader(raw))
	return resp, string(raw), nil
}

func (r *runner) getJSON(ctx context.Context, url string, target any, validate func(status int) error) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("decode status %d: %w: %s", resp.StatusCode, err, string(raw))
	}
	return validate(resp.StatusCode)
}

func (r *runner) findPublicID(ctx context.Context, collection string, field string, value string) (string, error) {
	var query string
	switch collection {
	case "teams":
		query = `query Find($search: String) { teams(search: $search) { id name } }`
	case "projects":
		query = `query Find($search: String) { projects(search: $search) { id title } }`
	default:
		return "", fmt.Errorf("unsupported collection %q", collection)
	}
	resp, err := r.graphql(ctx, "", query, map[string]any{"search": value})
	if err != nil {
		return "", err
	}
	if err := expectNoGraphErrors(resp); err != nil {
		return "", err
	}
	for _, item := range asSlice(resp.Data[collection]) {
		record := asMap(item)
		if record[field] == value {
			id := fmt.Sprint(record["id"])
			if err := requireNonEmpty(collection+" id", id); err != nil {
				return "", err
			}
			return id, nil
		}
	}
	return "", fmt.Errorf("could not find %s where %s = %q", collection, field, value)
}

func (r *runner) writeTokens(runID string, users ...*authUser) error {
	root := filepath.Clean(filepath.Join("..", ".."))
	dir := filepath.Join(root, ".planning")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	path := filepath.Join(dir, "neon-e2e-tokens-"+runID+".json")
	payload := map[string]any{
		"createdAt": time.Now().UTC().Format(time.RFC3339),
		"apiURL":    r.apiURL,
		"apiMode":   r.apiMode,
		"authBase":  r.authBase,
		"users":     users,
	}
	encoded, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		return err
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		r.tokenFile = path
	} else {
		r.tokenFile = abs
	}
	return nil
}

func expectNoGraphErrors(resp *graphResponse) error {
	if len(resp.Errors) == 0 {
		return nil
	}
	return fmt.Errorf("graphql errors: %s", graphErrorText(resp))
}

func expectGraphError(resp *graphResponse, want string) error {
	for _, err := range resp.Errors {
		if strings.Contains(err.Message, want) {
			return nil
		}
	}
	return fmt.Errorf("missing expected graphql error %q; got %s", want, graphErrorText(resp))
}

func graphHasError(resp *graphResponse, want string) bool {
	for _, err := range resp.Errors {
		if strings.Contains(err.Message, want) {
			return true
		}
	}
	return false
}

func graphErrorText(resp *graphResponse) string {
	var messages []string
	for _, err := range resp.Errors {
		messages = append(messages, err.Message)
	}
	return strings.Join(messages, "; ")
}

func sessionCookie(values []string) string {
	for _, value := range values {
		if strings.HasPrefix(value, "__Secure-neon-auth.session_token=") {
			return strings.Split(value, ";")[0]
		}
	}
	return ""
}

func asMap(value any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	out, _ := value.(map[string]any)
	return out
}

func asSlice(value any) []any {
	if value == nil {
		return nil
	}
	out, _ := value.([]any)
	return out
}

func requireNonEmpty(label string, value string) error {
	if strings.TrimSpace(value) == "" || value == "<nil>" {
		return fmt.Errorf("%s is empty", label)
	}
	return nil
}

func title(value string) string {
	parts := strings.Split(value, "_")
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func fatal(scope string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", scope, err)
	os.Exit(1)
}
