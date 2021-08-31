# syntax=docker/dockerfile:1
FROM node:lts-alpine
ENV NODE_ENV dev
WORKDIR /var/app
COPY ["./package.json", "./package-lock.json", "./tsconfig.json", "./"]
RUN npm ci
COPY ./src ./src
RUN npm run build
RUN npm prune --production



FROM node:lts-alpine
ENV NODE_ENV production
WORKDIR /var/app
COPY --from=0 /var/app/package.json .
COPY --from=0 /var/app/node_modules ./node_modules
COPY --from=0 /var/app/dist dist/

EXPOSE 5000
CMD ["npm", "run", "start"]