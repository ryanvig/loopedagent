FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY eslint.config.js ./
COPY src ./src
COPY production-safety.md ./production-safety.md

RUN npm run build
RUN ls -la /app/ && ls -la /app/dist/ 2>/dev/null || echo "dist directory does not exist"

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/production-safety.md ./production-safety.md
RUN chown -R app:app /app

USER app

EXPOSE 3000
CMD ["node", "dist/server.js"]
