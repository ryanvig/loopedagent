FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY eslint.config.js ./
COPY src ./src
COPY production-safety.md ./production-safety.md

RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/production-safety.md ./production-safety.md

EXPOSE 3000
CMD ["node", "dist/server.js"]
