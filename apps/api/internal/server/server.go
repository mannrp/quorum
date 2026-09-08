package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/auth"
	"github.com/local/quorum/apps/api/internal/config"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/graph"
	"github.com/local/quorum/apps/api/internal/graph/generated"
	"github.com/local/quorum/apps/api/internal/identity"
	"github.com/local/quorum/apps/api/internal/internalapi"
	"github.com/local/quorum/apps/api/internal/principal"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

func NewHandler(cfg config.Config, pool *pgxpool.Pool, logger *slog.Logger) http.Handler {
	queries := db.New(pool)
	resolver := &graph.Resolver{Pool: pool, Queries: queries}
	gql := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: resolver}))
	gql.SetErrorPresenter(graphQLErrorPresenter(logger))
	principalService := principal.NewService(principal.NewSQLViewerStore(queries), identity.NewService(pool))
	var assertionVerifier *internalapi.Verifier
	if len(cfg.InternalAssertionKeys) > 0 {
		var err error
		assertionVerifier, err = internalapi.NewVerifier(internalapi.VerifierConfig{
			Issuer: cfg.InternalAssertionIssuer, Audience: cfg.InternalAssertionAudience,
			Type: "quorum-internal+jwt", Keys: cfg.InternalAssertionKeys,
		})
		if err != nil {
			logger.Error("internal assertion verifier disabled", "error", err)
			assertionVerifier = nil
		}
	}
	authMiddleware := auth.NewMiddleware(queries, assertionVerifier, principalService)
	privateAPI := http.NotFoundHandler()
	if assertionVerifier != nil {
		privateAPI = principal.NewHTTPHandler(assertionVerifier, principalService)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler(pool))
	mux.Handle("/internal/v1/", privateAPI)
	mux.Handle("/graphql", maxBytes(1<<20, graph.WithRequestCache(authMiddleware.Wrap(gql))))
	if cfg.AppEnv == "development" {
		mux.Handle("/", playground.Handler("Quorum GraphQL", "/graphql"))
	}

	return logging(logger, mux)
}

// Domain errors are deliberate user feedback; dependency details stay server-side.
func graphQLErrorPresenter(logger *slog.Logger) graphql.ErrorPresenterFunc {
	return func(ctx context.Context, err error) *gqlerror.Error {
		var queryError *pgconn.PgError
		var connectionError *pgconn.ConnectError
		switch {
		case errors.As(err, &queryError):
			logger.Error("graphql database operation failed", "database_code", queryError.Code)
		case errors.As(err, &connectionError), errors.Is(err, pgx.ErrNoRows), errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
			logger.Error("graphql dependency operation failed")
		default:
			return graphql.DefaultErrorPresenter(ctx, err)
		}
		return gqlerror.Errorf("request could not be completed")
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
