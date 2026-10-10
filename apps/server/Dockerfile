# Production image for apps/server.
#
# Build from the REPO ROOT (monorepo context required):
#   docker build -f apps/server/Dockerfile -t project-alpha/server:<version> .
#
# Why no `pnpm deploy`: workspace packages (@repo/database, @repo/validation)
# are consumed as TypeScript SOURCE via Node type-stripping, and Node refuses
# to strip types for real files under node_modules
# (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). `pnpm deploy` inlines packages
# into node_modules, which breaks the boot. This image therefore keeps the
# workspace layout with symlinked workspace packages (exactly like local dev)
# and installs production-only third-party deps.
#
# Release flow (single replica — throttler is in-memory, see AppModule):
#   1. pnpm --filter database db:generate   # after editing src/schema.ts (commits SQL to drizzle/)
#   2. DATABASE_URL=<prod> pnpm --filter database db:migrate
#   3. docker build --build-arg APP_VERSION=<git-sha> ...
#   4. Replace the running container (readiness gate keeps traffic off until SELECT 1 passes).
ARG APP_VERSION=0.0.0

FROM node:24-alpine AS build
RUN npm install -g pnpm@11.22.0
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/server/package.json apps/server/
COPY packages/database/package.json packages/database/
COPY packages/validation/package.json packages/validation/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY apps/server apps/server
COPY packages packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter server build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ARG APP_VERSION=0.0.0
ENV APP_VERSION=${APP_VERSION}
RUN npm install -g pnpm@11.22.0 && addgroup -S app && adduser -S app -G app
WORKDIR /srv
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/server/package.json apps/server/
COPY packages/database/package.json packages/database/
COPY packages/validation/package.json packages/validation/
COPY packages/typescript-config/package.json packages/typescript-config/
# Production-only third-party deps; workspace links stay symlinks so Node can
# type-strip packages/* sources (see header comment).
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
# Compiled server + TypeScript sources of workspace packages (stripped at load).
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/packages/database/src packages/database/src
COPY --from=build /app/packages/validation/src packages/validation/src
# Never ship local secrets or build/test artifacts into the image.
RUN rm -f apps/server/.env apps/server/.env.local && chown -R app:app /srv
USER app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health/live || exit 1
CMD ["node", "apps/server/dist/main.js"]
