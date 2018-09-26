FROM node:alpine as build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -s
RUN npm audit fix
RUN npm prune --production
RUN rm -r package-lock.json

FROM node:alpine

COPY --from=build /app /app
WORKDIR /app
COPY index.js .
ENV NODE_ENV=production
CMD node index.js
