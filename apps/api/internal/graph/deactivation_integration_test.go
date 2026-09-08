package graph

import (
	"testing"

	"github.com/local/quorum/apps/api/internal/auth"
)

func TestDeactivateAccountUpdatesCanonicalState(t *testing.T) {
	ctx, resolver, cleanup := workflowTestResolver(t)
	user := createWorkflowUser(t, ctx, resolver.Queries, "deactivate", true)
	defer func() {
		_, _ = resolver.Pool.Exec(ctx, "DELETE FROM app.account_states WHERE user_id = $1", user.ID)
		cleanup()
	}()
	if _, err := resolver.Pool.Exec(ctx, `
INSERT INTO app.account_states (user_id)
VALUES ($1)`, user.ID); err != nil {
		t.Fatal(err)
	}

	ok, err := (&mutationResolver{resolver}).DeactivateAccount(auth.WithUser(ctx, user), nil)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("DeactivateAccount returned false")
	}

	var status string
	var stateVersion, revocationVersion int64
	var deactivated bool
	if err := resolver.Pool.QueryRow(ctx, `
SELECT status, state_version, session_revocation_version, deactivated_at IS NOT NULL
FROM app.account_states
WHERE user_id = $1`, user.ID).Scan(&status, &stateVersion, &revocationVersion, &deactivated); err != nil {
		t.Fatal(err)
	}
	if status != "DEACTIVATED" || stateVersion != 2 || revocationVersion != 1 || !deactivated {
		t.Fatalf("account state = %s/%d/%d/%t, want DEACTIVATED/2/1/true", status, stateVersion, revocationVersion, deactivated)
	}
}
