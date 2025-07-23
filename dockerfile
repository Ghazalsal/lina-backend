# Use official Node.js 20 LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the TypeScript project
RUN npx tsc -p tsconfig.node.json

# Expose the port your app listens on (change if needed)
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]
