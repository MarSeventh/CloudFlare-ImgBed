FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 8080
CMD ["npm", "run", "start"]
