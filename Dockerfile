FROM node:16.7.0-alpine as build
LABEL org.opencontainers.image.source https://github.com/chrisns/nest-aws-iot

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -s
COPY index.js .
ENV NODE_ENV=production
USER node
CMD node index.js
