# One image, two ECS services: API (default CMD) and worker (CMD ["node", "dist/worker.js"]).
# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @klyr/api... build \
 && pnpm --filter @klyr/api deploy --prod --legacy /out \
 && cp -r apps/api/drizzle /out/drizzle

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
