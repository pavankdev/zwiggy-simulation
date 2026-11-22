# Node.js Alpine base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Copy all application source code
COPY . .

# Expose default port
EXPOSE 3000

# Environment variable for production
ENV NODE_ENV=production
ENV PORT=3000

# Start command
CMD ["node", "server.js"]
