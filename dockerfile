# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build the project (compiles TypeScript)
RUN npm run build

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy build output from previous stage
COPY --from=builder /app/dist ./dist
# Ensure the data folder exists for persistence
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=4002

EXPOSE 4002

CMD ["node", "dist/server.js"]
