FROM node:18-bookworm-slim AS build

ARG SPECSPACE_RELEASE_COMMIT=
ARG SPECSPACE_RELEASE_CREATED_AT=
ARG SPECSPACE_VERSION=0.0.1

ENV VITE_SPECSPACE_RELEASE_COMMIT=$SPECSPACE_RELEASE_COMMIT \
    VITE_SPECSPACE_RELEASE_CREATED_AT=$SPECSPACE_RELEASE_CREATED_AT \
    VITE_SPECSPACE_VERSION=$SPECSPACE_VERSION

WORKDIR /app

COPY graphspace/package*.json ./
RUN npm ci

COPY graphspace/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY graphspace/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
