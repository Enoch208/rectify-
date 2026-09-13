FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @rectify/web build
ENV NODE_ENV=production
ENV PORT=3000
ENV REPORTDESK_PORT=3100
EXPOSE 3000 3100
CMD ["node", "scripts/start-all.mjs"]
