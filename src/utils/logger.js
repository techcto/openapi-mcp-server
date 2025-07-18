/**
 * Simple logging utility with different log levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'   // Reset
};

class Logger {
  constructor(level = 'INFO') {
    this.level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const color = LOG_COLORS[level];
    const reset = LOG_COLORS.RESET;
    
    let formattedMessage = `${color}[${timestamp}] ${level}:${reset} ${message}`;
    
    if (Object.keys(meta).length > 0) {
      formattedMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return formattedMessage;
  }

  error(message, meta = {}) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, meta));
    }
  }

  // Specific logging methods for common scenarios
  toolExecution(toolName, args, success = true) {
    const emoji = success ? '✅' : '❌';
    const level = success ? 'INFO' : 'ERROR';
    this[level.toLowerCase()](`${emoji} Tool execution: ${toolName}`, { args, success });
  }

  connectionEvent(event, connectionId, details = {}) {
    const emojis = {
      connect: '🌊',
      disconnect: '❌',
      keepalive: '💓',
      cleanup: '🧹'
    };
    
    this.info(`${emojis[event] || '📡'} Connection ${event}: ${connectionId}`, details);
  }

  mcpMessage(direction, method, id, details = {}) {
    const emoji = direction === 'in' ? '📨' : '📤';
    this.debug(`${emoji} MCP ${direction}: ${method}`, { id, ...details });
  }

  serverEvent(event, details = {}) {
    const emojis = {
      start: '🚀',
      stop: '🛑',
      error: '💥',
      health: '❤️'
    };
    
    this.info(`${emojis[event] || '🔧'} Server ${event}`, details);
  }
}

// Create default logger instance
const logger = new Logger(process.env.LOG_LEVEL || 'INFO');

export { Logger, logger };