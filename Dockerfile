# Build pack "Dockerfile" di Coolify.
# HTTP_PROXY / HTTPS_PROXY tidak perlu dideklarasikan: Docker menerimanya
# otomatis sebagai build-arg bawaan (diisi dari Build Variable di Coolify).
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server.js ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
