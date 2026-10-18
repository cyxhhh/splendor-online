FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY index.html ./
COPY assets ./assets
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 10000
CMD ["npm", "start"]
