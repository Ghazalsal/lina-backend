FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

# Install TypeScript globally to ensure tsc is available and executable
RUN npm install -g typescript

COPY . .

RUN tsc -p tsconfig.node.json

EXPOSE 3000

CMD ["node", "dist/server.js"]
