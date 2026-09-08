# syntax=docker/dockerfile:1
FROM golang:1.25.12-alpine AS build
WORKDIR /src/apps/api
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/quorum-api ./cmd/server \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/quorum-migrate ./cmd/migrate

FROM alpine:3.22
WORKDIR /app
RUN apk add --no-cache ca-certificates curl su-exec && addgroup -S -g 10001 quorum && adduser -S -u 10001 -G quorum quorum
COPY --from=build /out/quorum-api /usr/local/bin/quorum-api
COPY --from=build /out/quorum-migrate /usr/local/bin/quorum-migrate
COPY apps/api/migrations ./migrations
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod 0755 /usr/local/bin/docker-entrypoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD curl --fail --silent --show-error --unix-socket /run/quorum/api.sock http://quorum.internal/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
CMD ["/usr/local/bin/quorum-api"]
