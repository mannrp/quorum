package dbroles

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type Config struct {
	OperatorURL         string
	MigratorPassword    string
	AuthRuntimePassword string
	AppRuntimePassword  string
}

func (c Config) Validate() error {
	for name, value := range map[string]string{
		"OPERATOR_DATABASE_URL":        c.OperatorURL,
		"QUORUM_MIGRATOR_PASSWORD":     c.MigratorPassword,
		"QUORUM_AUTH_RUNTIME_PASSWORD": c.AuthRuntimePassword,
		"QUORUM_APP_RUNTIME_PASSWORD":  c.AppRuntimePassword,
	} {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s is required", name)
		}
	}
	return nil
}

func Bootstrap(ctx context.Context, conn *pgx.Conn, config Config) error {
	if err := config.Validate(); err != nil {
		return err
	}
	for _, role := range []string{"quorum_app_owner", "quorum_auth_owner", "quorum_integration_owner", "quorum_audit_owner"} {
		if err := ensureRole(ctx, conn, role, false, ""); err != nil {
			return err
		}
	}
	for role, password := range map[string]string{
		"quorum_migrator":     config.MigratorPassword,
		"quorum_auth_runtime": config.AuthRuntimePassword,
		"quorum_app_runtime":  config.AppRuntimePassword,
	} {
		if err := ensureRole(ctx, conn, role, true, password); err != nil {
			return err
		}
	}
	for _, role := range []string{"quorum_auth_runtime", "quorum_app_runtime"} {
		if err := revokeMemberships(ctx, conn, role); err != nil {
			return err
		}
	}

	var databaseName string
	if err := conn.QueryRow(ctx, "SELECT current_database()").Scan(&databaseName); err != nil {
		return fmt.Errorf("read current database: %w", err)
	}
	databaseIdentifier := pgx.Identifier{databaseName}.Sanitize()
	for _, role := range []string{"quorum_migrator", "quorum_auth_runtime", "quorum_app_runtime"} {
		statement := fmt.Sprintf("GRANT CONNECT ON DATABASE %s TO %s", databaseIdentifier, pgx.Identifier{role}.Sanitize())
		if _, err := conn.Exec(ctx, statement); err != nil {
			return fmt.Errorf("grant database connect to %s: %w", role, err)
		}
	}
	if _, err := conn.Exec(ctx, "REVOKE CREATE ON SCHEMA public FROM PUBLIC, quorum_auth_runtime, quorum_app_runtime"); err != nil {
		return fmt.Errorf("revoke public schema creation from public and runtime roles: %w", err)
	}
	return nil
}

func revokeMemberships(ctx context.Context, conn *pgx.Conn, member string) error {
	rows, err := conn.Query(ctx, `
		SELECT granted.rolname
		FROM pg_auth_members membership
		JOIN pg_roles granted ON granted.oid = membership.roleid
		JOIN pg_roles grantee ON grantee.oid = membership.member
		WHERE grantee.rolname = $1
	`, member)
	if err != nil {
		return fmt.Errorf("inspect memberships for role %s: %w", member, err)
	}
	var grantedRoles []string
	for rows.Next() {
		var granted string
		if err := rows.Scan(&granted); err != nil {
			rows.Close()
			return fmt.Errorf("read membership for role %s: %w", member, err)
		}
		grantedRoles = append(grantedRoles, granted)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("list memberships for role %s: %w", member, err)
	}
	rows.Close()

	for _, granted := range grantedRoles {
		statement := fmt.Sprintf("REVOKE %s FROM %s", pgx.Identifier{granted}.Sanitize(), pgx.Identifier{member}.Sanitize())
		if _, err := conn.Exec(ctx, statement); err != nil {
			return fmt.Errorf("revoke role %s from %s: %w", granted, member, err)
		}
	}
	return nil
}

func ensureRole(ctx context.Context, conn *pgx.Conn, name string, login bool, password string) error {
	var exists bool
	if err := conn.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)", name).Scan(&exists); err != nil {
		return fmt.Errorf("inspect role %s: %w", name, err)
	}
	identifier := pgx.Identifier{name}.Sanitize()
	attributes := "NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS"
	if login {
		var quotedPassword string
		if err := conn.QueryRow(ctx, "SELECT quote_literal($1)", password).Scan(&quotedPassword); err != nil {
			return fmt.Errorf("prepare password for role %s: %w", name, err)
		}
		attributes = "LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD " + quotedPassword
	}
	verb := "CREATE ROLE"
	if exists {
		verb = "ALTER ROLE"
	}
	if _, err := conn.Exec(ctx, fmt.Sprintf("%s %s %s", verb, identifier, attributes)); err != nil {
		return fmt.Errorf("configure role %s: %w", name, err)
	}
	return nil
}
