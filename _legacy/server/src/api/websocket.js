/**
 * WebSocket API Module
 *
 * Handles WebSocket server setup and client management including:
 * - Connection/disconnection handling
 * - Ping/pong keep-alive
 * - Broadcasting to all connected clients
 */

import { WebSocketServer } from "ws";

// Active WebSocket clients
let activeClients = [];

// ===================================================================
//                      WEBSOCKET SETUP
// ===================================================================

/**
 * Setup WebSocket server on an HTTP server
 * @param {http.Server} server - HTTP server to attach WebSocket to
 * @returns {WebSocketServer} The WebSocket server instance
 */
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    activeClients.push(ws);

    ws.on("message", (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
      activeClients = activeClients.filter((client) => client !== ws);
    });

    ws.on("error", (err) => console.error("WebSocket Error:", err));
  });

  return wss;
}

// ===================================================================
//                      BROADCASTING
// ===================================================================

/**
 * Broadcast data to all connected WebSocket clients
 * @param {Object} data - Data object to broadcast (will be JSON stringified)
 */
function broadcast(data) {
  if (activeClients.length === 0) return;
  const jsonData = JSON.stringify(data);
  activeClients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(jsonData);
    }
  });
}

/**
 * Get the number of active WebSocket clients
 * @returns {number} Number of connected clients
 */
function getActiveClientCount() {
  return activeClients.length;
}

// ===================================================================
//                      EXPORTS
// ===================================================================
export { setupWebSocket, broadcast, getActiveClientCount };
