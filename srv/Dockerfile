FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS production

# Copy assets from build
COPY --from=build /app/dist /app

EXPOSE 3000
CMD ["node", "/app/index.js"]
