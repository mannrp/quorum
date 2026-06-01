package graph

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require
// here.

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/local/quorum/apps/api/internal/db"
	"github.com/local/quorum/apps/api/internal/storage"
)

type Resolver struct {
	Pool    *pgxpool.Pool
	Queries *db.Queries
	Storage *storage.R2Signer
}
