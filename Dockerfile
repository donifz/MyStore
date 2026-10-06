FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run build && npm prune --omit=dev
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3001
CMD ["sh", "-c", "node apps/api/dist/scripts/migrate.js && node apps/api/dist/main.js"]
