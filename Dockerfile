FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl python3 make g++ && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install --omit=dev

EXPOSE 8080
CMD ["node", "--import", "./server/register.mjs", "server/index.js"]
