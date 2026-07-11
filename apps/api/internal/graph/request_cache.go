package graph

import (
	"context"
	"net/http"
	"sync"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/local/quorum/apps/api/internal/db"
)

type requestCacheKey struct{}

type cachedUser struct {
	value db.User
	err   error
}

type cachedTags struct {
	value []db.Tag
	err   error
}

type cachedBool struct {
	value bool
	err   error
}

type cachedMembership struct {
	value db.TeamMembership
	err   error
}

type requestCache struct {
	mu                  sync.Mutex
	users               map[string]cachedUser
	userTags            map[string]cachedTags
	adminStatus         map[string]cachedBool
	teamMemberships     map[string]cachedMembership
	teamLeadStatus      map[string]cachedBool
	activeProjectOwners map[string]cachedBool
}

func newRequestCache() *requestCache {
	return &requestCache{
		users:               map[string]cachedUser{},
		userTags:            map[string]cachedTags{},
		adminStatus:         map[string]cachedBool{},
		teamMemberships:     map[string]cachedMembership{},
		teamLeadStatus:      map[string]cachedBool{},
		activeProjectOwners: map[string]cachedBool{},
	}
}

func WithRequestCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), requestCacheKey{}, newRequestCache())
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func cacheFromContext(ctx context.Context) *requestCache {
	cache, _ := ctx.Value(requestCacheKey{}).(*requestCache)
	return cache
}

func membershipCacheKey(teamID pgtype.UUID, userID pgtype.UUID) string {
	return uuidString(teamID) + ":" + uuidString(userID)
}
