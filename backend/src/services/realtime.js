const jwt = require("jsonwebtoken");

const realtimeClients = new Map();
let realtimeClientSerial = 0;

function readPositiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function publishRealtimeEvent(type, payload = {}) {
  const event = { type, payload, sentAt: new Date().toISOString() };
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const [clientId, client] of realtimeClients.entries()) {
    try {
      client.res.write(data);
    } catch {
      client.cleanup();
      realtimeClients.delete(clientId);
    }
  }
}

function closeStaleClientsForUser(userId, keepClientId) {
  const maxConnections = readPositiveIntegerEnv("REALTIME_MAX_CONNECTIONS_PER_USER", 3);
  const clients = [...realtimeClients.entries()]
    .filter(([, client]) => client.userId === userId)
    .sort((a, b) => a[1].connectedAt - b[1].connectedAt);

  while (clients.length > maxConnections) {
    const [clientId, client] = clients.shift();
    if (clientId === keepClientId) continue;
    try {
      client.res.end();
    } catch {
      // Ignore already closed connections.
    }
    client.cleanup();
    realtimeClients.delete(clientId);
  }
}

function registerRealtimeRoutes(app) {
  app.get("/api/events", (req, res) => {
    const token = String(req.query?.token || "");
    if (!token) return res.status(401).json({ message: "未登入" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: "登入過期" });

      const clientId = `${Date.now()}-${++realtimeClientSerial}`;
      const userId = String(user?.id || user?.username || "anonymous");
      let heartbeatId;
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeatId) clearInterval(heartbeatId);
        realtimeClients.delete(clientId);
      };

      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      heartbeatId = setInterval(() => {
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch {
          cleanup();
        }
      }, 25000);

      realtimeClients.set(clientId, {
        res,
        user,
        userId,
        connectedAt: Date.now(),
        cleanup,
      });
      closeStaleClientsForUser(userId, clientId);

      res.write(`data: ${JSON.stringify({
        type: "connected",
        payload: { clientId },
        sentAt: new Date().toISOString(),
      })}\n\n`);

      req.on("close", cleanup);
      req.on("error", cleanup);
      res.on("close", cleanup);
      res.on("error", cleanup);
    });
  });
}

module.exports = { publishRealtimeEvent, registerRealtimeRoutes };
