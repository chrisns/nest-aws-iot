FROM node:alpine as build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install -s
COPY index.js .
ENV NODE_ENV=production
USER node
CMD node index.js
