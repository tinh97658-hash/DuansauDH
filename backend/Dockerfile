FROM node:22-alpine AS base

RUN apk add --no-cache tini && npm install --global npm@11.6.1
WORKDIR /app
ENTRYPOINT ["/sbin/tini", "--"]

FROM base AS build

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build

FROM base AS production

ENV NODE_ENV=production
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node --from=build /app/dist ./dist
RUN mkdir -p public/userDocs public/submissions/submitted public/img/users \
    && chown -R node:node public

USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
