# Local development only. The AWS deployment does not use this file:
# `npm run deploy` uploads the static web/dist folder to S3 and serves it
# through CloudFront, so there is no container running anywhere in AWS.
#
#   docker compose up
#       -> hot-reloading dev server on http://localhost:5173
#   docker build --target build --output type=local,dest=./web/dist .
#       -> the same web/dist the deploy uploads, built in a pinned image
#
# Node 24 matches the version used on the host.

# --- deps: dependency install, cached until the lockfile changes ------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci

# --- dev: hot-reloading Vite server ----------------------------------------
FROM deps AS dev
COPY web/ ./
EXPOSE 5173
# --host is set in vite.config.ts so the port is reachable from the host.
CMD ["npm", "run", "dev"]

# --- build: reproducible production bundle ----------------------------------
FROM deps AS builder
COPY web/ ./
RUN npm run build

# Exported with `--output type=local`; contains only the built site.
FROM scratch AS build
COPY --from=builder /app/dist/ ./
