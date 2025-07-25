# Stage 1: Build and install all dependencies
FROM node:22.12-alpine AS builder

# Add labels for better container management
LABEL org.opencontainers.image.title="OpenAPI MCP Server" \
      org.opencontainers.image.description="OpenAPI Model Context Protocol Server" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/techcto/openapi-mcp-server"

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with npm cache mount for faster builds
RUN npm ci --include=dev

# Copy source code
COPY . .

# Stage 2: Production image with only necessary files
FROM node:22-alpine AS release

# Add same labels to release image
LABEL org.opencontainers.image.title="OpenAPI MCP Server" \
      org.opencontainers.image.description="OpenAPI Model Context Protocol Server" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/techcto/openapi-mcp-server"

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpserver -u 1001 -G nodejs

# Copy necessary files from builder stage with proper ownership
COPY --from=builder --chown=mcpserver:nodejs /app/src ./src/
COPY --from=builder --chown=mcpserver:nodejs /app/package*.json ./
COPY --from=builder --chown=mcpserver:nodejs /app/samples ./samples/

# Set environment to production
ENV NODE_ENV=production

# Install only production dependencies with cache mount
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Switch to non-root user for security
USER mcpserver

# Expose the port your server will run on
EXPOSE 8000

# Add health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use ENTRYPOINT for better signal handling
ENTRYPOINT ["node", "src/server.js"]