# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
ENV NODE_ENV dev
WORKDIR /var/app
COPY ["./package.json", "./package-lock.json", "./tsconfig.json", "./"]
RUN npm ci
COPY ./resources ./resources
COPY ./src ./src
RUN npm run build
RUN npm prune --production



FROM node:20-alpine
ENV NODE_ENV production
WORKDIR /var/app
COPY --from=builder /var/app/package.json .
COPY --from=builder /var/app/node_modules node_modules/
COPY --from=builder /var/app/resources resources/
COPY --from=builder /var/app/dist dist/

EXPOSE 3000
ENTRYPOINT ["npm", "run", "start"]