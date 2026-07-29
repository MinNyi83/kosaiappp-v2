/**
 * WebSocket Manager — Handles real-time updates for connected clients.
 * Used by Tauri desktop and Android apps for live sync.
 */

interface WSClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  lastPing: number;
}

const clients = new Map<string, WSClient>();
let clientIdCounter = 0;

function generateClientId(): string {
  clientIdCounter++;
  return `ws-${clientIdCounter}-${Date.now()}`;
}

export function handleWebSocketUpgrade(request: Request, env: any): Response {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  const id = generateClientId();

  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  const wsClient: WSClient = {
    id,
    ws: server as any,
    lastPing: Date.now(),
  };
  clients.set(id, wsClient);

  server.accept();

  server.onmessage = (event) => {
    try {
      const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
      handleWSMessage(id, msg);
    } catch (e) {
      // Ignore malformed messages
    }
  };

  server.onclose = () => {
    clients.delete(id);
  };

  server.onerror = (err) => {
    console.error(`WebSocket error for ${id}:`, err);
    clients.delete(id);
  };

  // Send welcome message
  server.send(JSON.stringify({
    type: 'connected',
    clientId: id,
    timestamp: new Date().toISOString(),
  }));

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

function handleWSMessage(clientId: string, msg: any) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (msg.type) {
    case 'ping':
      client.lastPing = Date.now();
      client.ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    case 'subscribe':
      client.userId = msg.userId;
      client.ws.send(JSON.stringify({ type: 'subscribed', userId: msg.userId }));
      break;

    case 'request_sync':
      client.ws.send(JSON.stringify({
        type: 'sync_needed',
        timestamp: new Date().toISOString(),
      }));
      break;
  }
}

/**
 * Broadcast a message to all connected clients (or filter by userId).
 */
export function broadcast(data: any, filterUserId?: string) {
  const message = JSON.stringify(data);
  for (const [, client] of clients) {
    try {
      if (filterUserId && client.userId !== filterUserId) continue;
      if (client.ws.readyState === 1) {
        client.ws.send(message);
      }
    } catch (e) {
      // Ignore send errors
    }
  }
}

/**
 * Broadcast job update to all clients.
 */
export function broadcastJobUpdate(jobId: string, status: string, technicianId?: string) {
  broadcast({
    type: 'job_update',
    jobId,
    status,
    technicianId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast attendance update.
 */
export function broadcastAttendanceUpdate(technicianId: string, action: 'clock_in' | 'clock_out') {
  broadcast({
    type: 'attendance_update',
    technicianId,
    action,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send notification to a specific user.
 */
export function sendToUser(userId: string, data: any) {
  broadcast(data, userId);
}

/**
 * Get connected clients count.
 */
export function getConnectedClients(): number {
  return clients.size;
}

/**
 * Clean up stale connections (call periodically).
 */
export function cleanupStaleConnections() {
  const now = Date.now();
  const staleThreshold = 60000; // 60 seconds

  for (const [id, client] of clients) {
    if (now - client.lastPing > staleThreshold) {
      try {
        client.ws.close(1000, 'Stale connection');
      } catch (e) {
        // Ignore close errors
      }
      clients.delete(id);
    }
  }
}
