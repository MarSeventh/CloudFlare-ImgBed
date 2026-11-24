FROM node:22-slim AS dependencies

ARG PNPM_VERSION=10.33.0

WORKDIR /app

RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY deploy/profiles ./deploy/profiles

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    pnpm install \
        --filter @cloudflare-imgbed/common \
        --filter @cloudflare-imgbed/server \
        --prod \
        --frozen-lockfile && \
    rm -rf /root/.cache/node/corepack /root/.local/share/pnpm/store /var/lib/apt/lists/* /tmp/*

FROM node:22-slim AS runtime

ARG APP_VERSION
ARG APP_COMMIT_SHA
ARG APP_BUILD_ID
ARG APP_BUILD_DIRTY
ARG ASSET_PACKAGE_VERSION
ARG FRONTEND_DIST_SHA256

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    APP_COMMIT_SHA=${APP_COMMIT_SHA} \
    APP_BUILD_ID=${APP_BUILD_ID} \
    APP_BUILD_DIRTY=${APP_BUILD_DIRTY} \
    ASSET_PACKAGE_VERSION=${ASSET_PACKAGE_VERSION} \
    FRONTEND_DIST_SHA256=${FRONTEND_DIST_SHA256}

LABEL org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${APP_COMMIT_SHA}" \
      org.opencontainers.image.source="https://github.com/MarSeventh/CloudFlare-ImgBed"

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY deploy/profiles ./deploy/profiles
COPY frontend-dist ./frontend-dist
COPY functions ./functions
COPY database ./database
COPY deploy/server ./deploy/server

EXPOSE 8080
CMD ["node", "--import", "./deploy/server/register.mjs", "deploy/server/index.js"]
