# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Install typescript globally for the build step
RUN npm install -g typescript

# Build the project (compiles TypeScript)
RUN tsc -p tsconfig.node.json

# Stage 2: Run
FROM node:20-alpine

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy build output from previous stage
COPY --from=builder /app/dist ./dist

# Copy utils, models, etc. if needed (if outside dist)
# COPY --from=builder /app/models ./models
# COPY --from=builder /app/utils ./utils

# Copy any static assets (public folder)
# COPY --from=builder /app/public ./public

ENV NODE_ENV=production

EXPOSE 4002

CMD ["node", "dist/server.js"]
