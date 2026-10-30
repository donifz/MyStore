FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci
COPY apps/api apps/api
COPY apps/web apps/web
COPY apps/storefront apps/storefront
RUN npm run build && npm prune --omit=dev
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /app/apps/storefront/.next ./apps/storefront/.next
COPY --from=build --chown=node:node /app/apps/storefront/public ./apps/storefront/public
COPY --from=build --chown=node:node /app/apps/storefront/package.json /app/apps/storefront/next.config.mjs ./apps/storefront/
USER node
EXPOSE 3001
CMD ["sh", "-c", "node apps/api/dist/scripts/migrate.js && node apps/api/dist/main.js"]
