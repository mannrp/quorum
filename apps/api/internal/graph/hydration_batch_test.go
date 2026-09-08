package graph

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/local/quorum/apps/api/internal/auth"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/graph/model"
)

// countingDBTX wraps a db.DBTX and records every SQL statement it runs so a test
// can assert how many queries a hydration path issued.
type countingDBTX struct {
	inner db.DBTX
	mu    sync.Mutex
	sql   []string
}

func (c *countingDBTX) record(sql string) {
	c.mu.Lock()
	c.sql = append(c.sql, sql)
	c.mu.Unlock()
}

func (c *countingDBTX) count(substr string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	n := 0
	for _, s := range c.sql {
		if strings.Contains(s, substr) {
			n++
		}
	}
	return n
}

func (c *countingDBTX) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	c.record(sql)
	return c.inner.Exec(ctx, sql, args...)
}

func (c *countingDBTX) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	c.record(sql)
	return c.inner.Query(ctx, sql, args...)
}

func (c *countingDBTX) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	c.record(sql)
	return c.inner.QueryRow(ctx, sql, args...)
}

// TestTeamHydrationBatchesPerTeamQueries proves the dashboard's myTeams path issues
// its per-team member and membership lookups once for the whole set instead of once
// per team, and never falls back to the single-team member query.
func TestTeamHydrationBatchesPerTeamQueries(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	lead := createWorkflowUser(t, ctx, r.Queries, "batlead", true)
	member := createWorkflowUser(t, ctx, r.Queries, "batmember", true)
	teamA := createWorkflowTeam(t, ctx, r.Queries, lead, "batteamA")
	teamB := createWorkflowTeam(t, ctx, r.Queries, lead, "batteamB")
	if _, err := r.Queries.AddTeamMember(ctx, db.AddTeamMemberParams{
		TeamID: teamA.ID, UserID: member.ID, Role: string(model.TeamRoleMember),
	}); err != nil {
		t.Fatal(err)
	}

	// A resolver whose queries run through the counting wrapper, and a request-scoped
	// cache + viewer identity as the HTTP middleware would install.
	counter := &countingDBTX{inner: r.Pool}
	counted := &Resolver{Pool: r.Pool, Queries: db.New(counter)}
	reqCtx := context.WithValue(ctx, requestCacheKey{}, newRequestCache())
	reqCtx = auth.WithUser(reqCtx, lead)

	options := teamHydrationOptions{
		includeCreatedBy:   true,
		includeMembers:     true,
		includeProject:     true,
		includePermissions: true,
		includeMemberTeam:  true,
	}
	teams := []db.Team{teamA, teamB}
	if err := counted.primeTeamHydration(reqCtx, teams, options); err != nil {
		t.Fatal(err)
	}
	hydrated := make([]*model.Team, 0, len(teams))
	for _, team := range teams {
		mapped, err := counted.teamWithOptions(reqCtx, team, options)
		if err != nil {
			t.Fatal(err)
		}
		hydrated = append(hydrated, mapped)
	}

	// Correctness is preserved: teamA carries lead + member, teamB the lead only,
	// and the lead's permissions resolve on both.
	if len(hydrated[0].Members) != 2 {
		t.Fatalf("teamA members = %d, want 2", len(hydrated[0].Members))
	}
	if len(hydrated[1].Members) != 1 {
		t.Fatalf("teamB members = %d, want 1", len(hydrated[1].Members))
	}
	if !hydrated[0].Permissions.CanEdit || !hydrated[1].Permissions.CanEdit {
		t.Fatalf("lead should be able to edit both teams")
	}

	// Batching: the two per-team queries run once total across both teams, and the
	// single-team member query is never used on this path.
	if got := counter.count("tm.team_id = ANY($1::uuid[])"); got != 1 {
		t.Fatalf("batched member query ran %d times, want 1", got)
	}
	if got := counter.count("team_id = ANY($2::uuid[])"); got != 1 {
		t.Fatalf("batched membership query ran %d times, want 1", got)
	}
	if got := counter.count("WHERE tm.team_id = $1"); got != 0 {
		t.Fatalf("per-team member query ran %d times, want 0", got)
	}
}

// TestProjectHydrationBatchesPerProjectQueries proves the dashboard's myProjects path
// issues its per-project application lookup once for the whole set, never falls back to
// the single-project query, and reuses the projects it already holds for the ownership
// check instead of re-fetching each one.
func TestProjectHydrationBatchesPerProjectQueries(t *testing.T) {
	ctx, r, cleanup := workflowTestResolver(t)
	defer cleanup()

	owner := createWorkflowUser(t, ctx, r.Queries, "projowner", true)
	applicant := createWorkflowUser(t, ctx, r.Queries, "projapplicant", true)
	team := createWorkflowTeam(t, ctx, r.Queries, applicant, "projteam")
	projectA := createWorkflowProject(t, ctx, r.Queries, owner, "projA")
	projectB := createWorkflowProject(t, ctx, r.Queries, owner, "projB")
	createWorkflowApplication(t, ctx, r.Pool, projectA.ID, team.ID, applicant.ID, "PENDING")
	createWorkflowApplication(t, ctx, r.Pool, projectB.ID, team.ID, applicant.ID, "PENDING")

	counter := &countingDBTX{inner: r.Pool}
	counted := &Resolver{Pool: r.Pool, Queries: db.New(counter)}
	reqCtx := context.WithValue(ctx, requestCacheKey{}, newRequestCache())
	reqCtx = auth.WithUser(reqCtx, owner)

	options := projectHydrationOptions{includeApplications: true}
	projects := []db.Project{projectA, projectB}
	if err := counted.primeProjectHydration(reqCtx, projects, options); err != nil {
		t.Fatal(err)
	}
	hydrated := make([]*model.Project, 0, len(projects))
	for _, project := range projects {
		mapped, err := counted.projectWithOptions(reqCtx, project, options)
		if err != nil {
			t.Fatal(err)
		}
		hydrated = append(hydrated, mapped)
	}

	// Correctness: each project surfaces its one application.
	if len(hydrated[0].Applications) != 1 || len(hydrated[1].Applications) != 1 {
		t.Fatalf("applications = %d/%d, want 1/1", len(hydrated[0].Applications), len(hydrated[1].Applications))
	}

	// Batching: the per-project application query runs once total, the single-project
	// query is never used, and the ownership check re-fetches no project (rows primed).
	if got := counter.count("pa.project_id = ANY($1::uuid[])"); got != 1 {
		t.Fatalf("batched application query ran %d times, want 1", got)
	}
	if got := counter.count("WHERE project_id = $1"); got != 0 {
		t.Fatalf("per-project application query ran %d times, want 0", got)
	}
	if got := counter.count("FROM projects WHERE id = $1"); got != 0 {
		t.Fatalf("per-project GetProject ran %d times, want 0", got)
	}
}
