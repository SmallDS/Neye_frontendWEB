FROM node:22.18-alpine AS builder

WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@11.7.0 --activate

COPY . .

ARG VITE_NEYE_API_BASE_URL=/api
ARG VITE_GLOB_API_URL=/api
ARG VITE_ROUTER_HISTORY=html5

ENV VITE_NEYE_API_BASE_URL=${VITE_NEYE_API_BASE_URL}
ENV VITE_GLOB_API_URL=${VITE_GLOB_API_URL}
ENV VITE_ROUTER_HISTORY=${VITE_ROUTER_HISTORY}
ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=8192

RUN pnpm install --frozen-lockfile \
  && cd apps/web-antd \
  && ../../node_modules/.bin/vite build --mode production

FROM nginx:1.27-alpine

COPY apps/web-antd/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web-antd/dist /usr/share/nginx/html

EXPOSE 80