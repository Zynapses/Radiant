# RADIANT Egress Proxy - HTTP/2 Connection Pool
# Runs on Fargate for persistent HTTP/2 multiplexing

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 9000

USER node

CMD ["node", "dist/index.js"]
