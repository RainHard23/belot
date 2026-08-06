FROM node:22-alpine AS deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY shared ./shared
WORKDIR /app/server
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=build /app/server/package.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/shared /app/shared
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server/src/main.js"]
