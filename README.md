# OpenAPI MCP Server

A refactored Node.js server that provides OpenAPI schema tools via the Model Context Protocol (MCP), with support for Server-Sent Events (SSE) and HTTP endpoints.

## 📁 Project Structure

```
src/
├── server.js              # Main application entry point
├── config/
│   └── config.js          # Configuration constants and settings
├── routes/
│   ├── sse.js            # Server-Sent Events endpoints for MCP
│   ├── mcp.js            # Standard MCP JSON-RPC endpoints  
│   ├── legacy.js         # Legacy endpoints for backward compatibility
│   └── info.js           # Info and health check endpoints
├── services/
│   ├── connectionManager.js    # SSE connection management
│   └── mcpMessageHandler.js    # MCP message processing logic
├── utils/
│   ├── schemaLoader.js   # OpenAPI schema loading utilities
│   └── toolUtils.js      # Tool management utilities
└── tools/
    ├── registerTools.js  # Tool registration (not refactored in this example)
    └── registerActions.js # Action registration (not refactored in this example)
```

## 🚀 Features

- **Dual Transport Support**: HTTP server for web APIs and STDIO server for direct MCP communication
- **Modular Architecture**: Clean separation of concerns with dedicated modules
- **SSE Support**: Real-time communication via Server-Sent Events
- **MCP Protocol**: Full Model Context Protocol implementation
- **Tool Management**: Flexible tool registration and execution
- **Connection Management**: Automatic cleanup of idle SSE connections
- **Health Monitoring**: Built-in health checks and metrics
- **API Compatibility**: Multiple endpoint formats for different use cases

## 📦 Installation

```bash
npm install
```

## 🏃‍♂️ Running the Server

### HTTP Server (Web API)
```bash
# Production
npm start

# Development (with nodemon)
npm run dev
```

### MCP Client (STDIO Protocol)
```bash
# Production
npm run client

# Development (with nodemon)  
npm run dev:client
```

## 🔧 Configuration

Environment variables:
- `PORT` - Server port (default: 8000)
- `OPENAPI_URL` - Default OpenAPI schema URL
- `API_TOKEN` - Authorization token for remote schema access
- `NODE_ENV` - Environment mode (development/production)

## 📡 API Endpoints

### MCP STDIO Client
- `npm run client` - Direct MCP protocol communication via STDIO

### MCP HTTP  
- `GET /sse` - Server-Sent Events for MCP communication
- `POST /sse` - Send MCP JSON-RPC messages via POST
- `POST /mcp` - Standard MCP JSON-RPC endpoint

### API Endpoints
- `POST /initialize` - MCP initialization
- `POST /tools/list` - List available tools
- `POST /tools/call` - Call a specific tool
- `POST /call-tool` - Legacy tool calling endpoint

### Info Endpoints
- `GET /` - Server information and usage
- `GET /health` - Health check

## 🏗️ Key Improvements

1. **Separation of Concerns**: Each module has a single responsibility
2. **Configuration Management**: Centralized configuration in `config.js`
3. **Connection Management**: Dedicated service for SSE connection handling
4. **Message Processing**: Isolated MCP message handling logic
5. **Utility Functions**: Reusable tool management utilities
6. **Middleware System**: Modular middleware for validation, logging, and error handling
7. **Logging System**: Structured logging with different levels and colors
8. **Error Handling**: Comprehensive error handling with proper HTTP status codes
9. **Rate Limiting**: Built-in rate limiting to prevent abuse
10. **Docker Support**: Ready-to-use Docker configuration

## 🔧 Development

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Setup
```bash
# Clone and install
git clone <repository>
cd openapi-mcp-server
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# For testing with the sample Petstore API:
# Set OPENAPI_URL=./samples/petstore.yaml in your .env file
```

### Development Commands
```bash
# Start in development mode
npm run dev

# Start MCP client in development mode
npm run dev:client

# Run server tests (HTTP endpoints)
npm test

# Run MCP protocol tests
npm run test:mcp

# Run MCP client tests (STDIO)
npm run test:client

# Run all tests
npm run test:all

# Test with different schemas
TEST_CONFIG=cms npm run test:client

# Health check
curl http://localhost:8000/health
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📊 Monitoring

The server provides several monitoring endpoints:

- `/health` - Health status and metrics
- `/` - Server information and configuration
- Built-in logging with configurable levels
- SSE connection monitoring

## 🔒 Security Features

- Rate limiting (configurable)
- Request validation
- CORS configuration
- Error sanitization in production
- Non-root Docker user