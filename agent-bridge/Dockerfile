# Multi-stage build for Agent Bridge
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 agentbridge && adduser -u 1001 -G agentbridge -D agentbridge

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/

RUN chown -R agentbridge:agentbridge /app

USER agentbridge

ENV NODE_ENV=production
ENV PORT=4401
ENV HOST=0.0.0.0

EXPOSE 4401 4402

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4401/health').then(r=>{if(r.status!==200)throw new Error(r.status);else process.exit(0)})"

CMD ["node", "dist/index.js"]
