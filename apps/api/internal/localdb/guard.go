package localdb

import (
	"crypto/subtle"
	"fmt"
	"net"
	"net/url"
	"strings"
)

var allowedHosts = map[string]struct{}{
	"127.0.0.1": {},
	"::1":       {},
	"localhost": {},
	"postgres":  {},
}

var allowedDatabases = map[string]struct{}{
	"quorum_dev":  {},
	"quorum_test": {},
}

func ValidateResetTarget(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return fmt.Errorf("LOCAL_TEST_DATABASE_URL must be a PostgreSQL URL")
	}
	host := strings.ToLower(parsed.Hostname())
	if ip := net.ParseIP(host); ip != nil && !ip.IsLoopback() {
		return fmt.Errorf("database host must be loopback or the exact local Compose service")
	}
	if _, ok := allowedHosts[host]; !ok {
		return fmt.Errorf("database host %q is not an approved local target", host)
	}
	database := strings.TrimPrefix(parsed.EscapedPath(), "/")
	if decoded, decodeErr := url.PathUnescape(database); decodeErr == nil {
		database = decoded
	}
	if _, ok := allowedDatabases[database]; !ok {
		return fmt.Errorf("database %q is not an approved local reset target", database)
	}
	return nil
}

func ValidateMarker(hostMarker, databaseMarker string) error {
	hostMarker = strings.TrimSpace(hostMarker)
	databaseMarker = strings.TrimSpace(databaseMarker)
	if hostMarker == "" || databaseMarker == "" {
		return fmt.Errorf("both host and database instance markers are required")
	}
	if len(hostMarker) != len(databaseMarker) || subtle.ConstantTimeCompare([]byte(hostMarker), []byte(databaseMarker)) != 1 {
		return fmt.Errorf("local instance marker mismatch")
	}
	return nil
}
