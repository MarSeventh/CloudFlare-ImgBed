FROM node:22-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    npm ci --omit=dev --include=optional && \
    rm -rf /root/.npm /var/lib/apt/lists/* /tmp/*

FROM node:22-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY frontend-dist ./frontend-dist
COPY functions ./functions
COPY database ./database
COPY deploy/server ./deploy/server

EXPOSE 8080
CMD ["node", "--import", "./deploy/server/register.mjs", "deploy/server/index.js"]
