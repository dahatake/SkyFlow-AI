# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f services/engine-mcp/Dockerfile .
FROM node:22-slim AS deps
WORKDIR /srv/services/engine-mcp
COPY services/engine-mcp/package.json services/engine-mcp/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /srv
# The engine is imported straight from the app sources: domain + i18n + the JSON the domain reads.
COPY app/src/domain ./app/src/domain
COPY app/src/i18n ./app/src/i18n
COPY app/src/data/changi/routes.json ./app/src/data/changi/routes.json
COPY --from=deps /srv/services/engine-mcp/node_modules ./services/engine-mcp/node_modules
COPY services/engine-mcp/package.json services/engine-mcp/tsconfig.json ./services/engine-mcp/
COPY services/engine-mcp/src ./services/engine-mcp/src
RUN chown -R node:node /srv
USER node
WORKDIR /srv/services/engine-mcp
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/index.ts"]
