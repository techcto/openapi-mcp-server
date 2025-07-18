import morgan from "morgan";
import cors from "cors";
import express from "express";
import { CONFIG } from '../config/config.js';

/**
 * Error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: {
      code: -32603,
      message: "Internal server error",
      ...(isDevelopment && { data: err.message, stack: err.stack })
    }
  });
};

/**
 * Request logging middleware
 */
export const requestLogger = morgan('combined', {
  skip: (req, res) => {
    // Skip logging for health checks and keep-alive requests
    return req.url === '/health' || req.url.includes('keepalive');
  }
});

/**
 * CORS middleware with custom configuration
 */
export const corsMiddleware = cors(CONFIG.cors);

/**
 * JSON parsing middleware with error handling
 */
export const jsonParser = express.json({
  limit: '10mb',
  type: 'application/json'
});

/**
 * Request validation middleware
 */
export const validateJsonRpc = (req, res, next) => {
  // Only validate for MCP endpoints
  if (!req.path.includes('/mcp') && !req.path.includes('/sse')) {
    return next();
  }

  const { jsonrpc, method, id } = req.body || {};
  
  if (req.method === 'POST' && (!jsonrpc || jsonrpc !== '2.0')) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: id || null,
      error: {
        code: -32600,
        message: "Invalid Request - missing or invalid jsonrpc version"
      }
    });
  }

  if (req.method === 'POST' && !method) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: id || null,
      error: {
        code: -32600,
        message: "Invalid Request - missing method"
      }
    });
  }

  next();
};

/**
 * Rate limiting middleware (simple implementation)
 */
export const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  const clients = new Map();

  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!clients.has(clientId)) {
      clients.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const client = clients.get(clientId);
    
    if (now > client.resetTime) {
      // Reset the counter
      client.count = 1;
      client.resetTime = now + windowMs;
      return next();
    }

    if (client.count >= maxRequests) {
      return res.status(429).json({
        error: {
          code: -32603,
          message: "Too many requests"
        }
      });
    }

    client.count++;
    next();
  };
};

/**
 * Setup all middleware
 */
export const setupMiddleware = (app) => {
  // Basic middleware
  app.use(requestLogger);
  app.use(corsMiddleware);
  app.use(jsonParser);
  
  // Custom middleware
  app.use(validateJsonRpc);
  app.use(rateLimiter(200, 60000)); // 200 requests per minute
  
  // Error handling (must be last)
  app.use(errorHandler);
};