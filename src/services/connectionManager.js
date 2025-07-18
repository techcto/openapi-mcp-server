import { CONFIG } from '../config/config.js';

// Connection manager for SSE connections
class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.startCleanupTimer();
  }

  /**
   * Add a new SSE connection
   */
  addConnection(connectionId, res) {
    const connection = { res, lastActive: Date.now() };
    this.connections.set(connectionId, connection);
    console.log(`🌊 New SSE connection: ${connectionId}`);
    
    // Send initial connection message
    this.sendToConnection(connectionId, {
      type: "connection",
      connectionId,
      timestamp: new Date().toISOString()
    });

    return connection;
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId) {
    if (this.connections.has(connectionId)) {
      console.log(`❌ SSE connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
    }
  }

  /**
   * Send data to a specific connection
   */
  sendToConnection(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      if (connection.res.writableEnded || connection.res.destroyed) {
        this.removeConnection(connectionId);
        return false;
      }

      const message = `data: ${JSON.stringify(data)}\n\n`;
      connection.res.write(message);
      connection.lastActive = Date.now();
      return true;
    } catch (err) {
      console.warn(`⚠️ Write error for connection ${connectionId}:`, err.message);
      this.removeConnection(connectionId);
      return false;
    }
  }

  /**
   * Send keep-alive ping to a connection
   */
  sendKeepAlive(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    try {
      if (connection.res.writableEnded || connection.res.destroyed) {
        this.removeConnection(connectionId);
        return false;
      }

      connection.res.write(`: keepalive ${Date.now()}\n\n`);
      connection.lastActive = Date.now();
      return true;
    } catch (err) {
      console.warn(`⚠️ Keep-alive error for connection ${connectionId}:`, err.message);
      this.removeConnection(connectionId);
      return false;
    }
  }

  /**
   * Broadcast data to all connections
   */
  broadcast(data) {
    const responseData = `data: ${JSON.stringify(data)}\n\n`;
    let successCount = 0;

    this.connections.forEach((connection, connectionId) => {
      try {
        if (!connection.res.writableEnded && !connection.res.destroyed) {
          connection.res.write(responseData);
          connection.lastActive = Date.now();
          successCount++;
        } else {
          this.removeConnection(connectionId);
        }
      } catch (err) {
        console.error(`Error broadcasting to connection ${connectionId}:`, err);
        this.removeConnection(connectionId);
      }
    });

    return successCount;
  }

  /**
   * Get connection count
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Setup keep-alive for a connection
   */
  setupKeepAlive(connectionId) {
    const keepAlive = setInterval(() => {
      if (!this.sendKeepAlive(connectionId)) {
        clearInterval(keepAlive);
      }
    }, CONFIG.sse.keepAliveInterval);

    return keepAlive;
  }

  /**
   * Clean up idle connections
   */
  cleanupIdleConnections() {
    const now = Date.now();
    const toRemove = [];

    for (const [id, conn] of this.connections.entries()) {
      if (now - conn.lastActive > CONFIG.sse.connectionTimeout) {
        console.log(`🧹 Removing idle SSE connection: ${id}`);
        try {
          conn.res.end();
        } catch (err) {
          console.warn(`⚠️ Error closing idle connection ${id}:`, err.message);
        }
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.connections.delete(id));
    return toRemove.length;
  }

  /**
   * Start periodic cleanup of idle connections
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupIdleConnections();
    }, CONFIG.sse.cleanupInterval);
  }

  /**
   * Close all connections
   */
  closeAll() {
    this.connections.forEach((connection, connectionId) => {
      try {
        connection.res.end();
      } catch (err) {
        console.warn(`⚠️ Error closing connection ${connectionId}:`, err.message);
      }
    });
    this.connections.clear();
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();

// Also export the class if needed
export { ConnectionManager };