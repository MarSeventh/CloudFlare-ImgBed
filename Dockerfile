FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm run install:all && npm run build && \
    rm -rf frontend/node_modules

EXPOSE 8080
CMD ["npm", "run", "dev:backend"]
