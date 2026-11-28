FROM node:22-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY deploy/profiles ./deploy/profiles

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    npm ci --workspace=@cloudflare-imgbed/common --workspace=@cloudflare-imgbed/server --omit=dev && \
    rm -rf /root/.npm /var/lib/apt/lists/* /tmp/*

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
