FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM base AS api-deps
WORKDIR /app/api
COPY api/package*.json ./
RUN npm install

FROM api-deps AS final
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=api-deps /app/api/node_modules ./api/node_modules
COPY . .
RUN mkdir -p bots tmp
EXPOSE 5000
ENV PORT=5000
CMD ["node", "server.js"]
