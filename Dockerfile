# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    FORCE_COLOR=1

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY web ./web

RUN mkdir -p /app/reference /app/saves \
    && chown -R node:node /app

USER node

ENV HOST=0.0.0.0 \
    PORT=3000

EXPOSE 3000

CMD ["npm", "run", "serve"]
