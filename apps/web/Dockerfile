# syntax=docker/dockerfile:1
FROM node:22.23.1-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=@quorum/web
COPY apps/web apps/web
RUN npm run build --workspace=@quorum/web && npm prune --omit=dev --workspace=@quorum/web

FROM node:22.23.1-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S -g 10001 quorum && adduser -S -u 10001 -G quorum quorum
COPY --from=build --chown=quorum:quorum /app/package.json /app/package-lock.json ./
COPY --from=build --chown=quorum:quorum /app/node_modules ./node_modules
COPY --from=build --chown=quorum:quorum /app/apps/web ./apps/web
USER quorum
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start", "--workspace=@quorum/web"]
