package auth

import (
	"context"

	"github.com/local/quorum/apps/api/internal/db"
)

type contextKey string

const userContextKey contextKey = "quorum_user"
const subjectContextKey contextKey = "quorum_subject"
const rolesContextKey contextKey = "quorum_roles"

const (
	RoleStudent = "STUDENT"
	RoleSponsor = "SPONSOR"
)

func WithUser(ctx context.Context, user db.User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func UserFromContext(ctx context.Context) (db.User, bool) {
	user, ok := ctx.Value(userContextKey).(db.User)
	return user, ok
}

func WithSubject(ctx context.Context, subject string) context.Context {
	return context.WithValue(ctx, subjectContextKey, subject)
}

func SubjectFromContext(ctx context.Context) (string, bool) {
	subject, ok := ctx.Value(subjectContextKey).(string)
	return subject, ok
}

// WithRoles records roles resolved from current product state. Callers must
// never populate this value from browser input or assertion claims.
func WithRoles(ctx context.Context, roles []string) context.Context {
	roleSet := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		if role != "" {
			roleSet[role] = struct{}{}
		}
	}
	return context.WithValue(ctx, rolesContextKey, roleSet)
}

func HasRole(ctx context.Context, role string) bool {
	roles, ok := ctx.Value(rolesContextKey).(map[string]struct{})
	if !ok {
		return false
	}
	_, ok = roles[role]
	return ok
}
