package server

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/auth"
	"github.com/local/quorum/apps/api/internal/config"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/demo"
	"github.com/local/quorum/apps/api/internal/graph"
	"github.com/local/quorum/apps/api/internal/graph/generated"
	"github.com/local/quorum/apps/api/internal/storage"
)

func NewHandler(cfg config.Config, pool *pgxpool.Pool, logger *slog.Logger) http.Handler {
	queries := db.New(pool)
	resolver := &graph.Resolver{Pool: pool, Queries: queries, Storage: storage.NewR2Signer(cfg)}
	gql := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: resolver}))
	authMiddleware := auth.NewMiddleware(queries, auth.NewVerifier(cfg.NeonAuthIssuer, cfg.NeonAuthJWKSURL, cfg.NeonAuthAudience), cfg.DemoModeEnabled)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler(pool))
	mux.HandleFunc("/demo/reset", demoResetHandler(cfg, pool, queries))
	mux.Handle("/graphql", maxBytes(1<<20, authMiddleware.Wrap(gql)))
	if cfg.AppEnv == "development" {
		mux.Handle("/", playground.Handler("Quorum GraphQL", "/graphql"))
	}

	return logging(logger, cors(cfg.AppOrigin, mux))
}

func demoResetHandler(cfg config.Config, pool *pgxpool.Pool, queries *db.Queries) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !cfg.DemoModeEnabled || !cfg.DemoResetEnabled {
			http.Error(w, "demo reset is disabled", http.StatusNotFound)
			return
		}
		authID, ok := demo.AuthIDForPersona(strings.TrimSpace(r.Header.Get(demo.HeaderPersona)))
		if !ok {
			http.Error(w, "invalid demo persona", http.StatusUnauthorized)
			return
		}
		user, err := queries.GetUserByAuthID(r.Context(), authID)
		if err != nil {
			http.Error(w, "demo persona is not seeded", http.StatusUnauthorized)
			return
		}
		isAdmin, err := queries.IsAdmin(r.Context(), user.ID)
		if err != nil {
			http.Error(w, "admin lookup failed", http.StatusInternalServerError)
			return
		}
		if !isAdmin {
			http.Error(w, "admin access required", http.StatusForbidden)
			return
		}
		if err := demo.Seed(r.Context(), pool, true); err != nil {
			http.Error(w, "demo reset failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "reset"})
	}
}

func NewHTTPServer(cfg config.Config, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

func healthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		status := http.StatusOK
		dbStatus := "ok"
		if err := pool.Ping(ctx); err != nil {
			status = http.StatusServiceUnavailable
			dbStatus = "unavailable"
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":   http.StatusText(status),
			"database": dbStatus,
		})
	}
}

func maxBytes(limit int64, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}

func logging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(start).Milliseconds())
	})
}

func cors(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, "+demo.HeaderPersona)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
