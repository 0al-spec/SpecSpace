FROM node:18-bookworm-slim AS build

WORKDIR /app

COPY graphspace/package*.json ./
RUN npm ci

COPY graphspace/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY graphspace/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
