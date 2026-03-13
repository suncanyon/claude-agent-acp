import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { logger } from './logger.js';
import { ServerConfig } from './server-config.js';

export function startServer(config: ServerConfig): void {
  const httpServer = config.tlsCertPath && config.tlsKeyPath
    ? createHttpsServer({
        cert: readFileSync(config.tlsCertPath),
        key: readFileSync(config.tlsKeyPath),
      })
    : createServer();

  const wss = new WebSocketServer({ noServer: true });

  // Auth on upgrade
  httpServer.on('upgrade', (req, socket, head) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (config.authToken && token !== config.authToken) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      logger.warn('Rejected connection: invalid token');
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    logger.info('Client connected');

    const child = spawn(config.claudeAgentCmd, config.claudeAgentArgs, {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    logger.info(`Spawned child process pid=${child.pid}`);

    // WebSocket → child stdin
    ws.on('message', (data) => {
      if (child.stdin?.writable) {
        child.stdin.write(data.toString() + '\n');
      }
    });

    // child stdout → WebSocket
    child.stdout?.on('data', (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk.toString());
      }
    });

    // child stderr → logs only
    child.stderr?.on('data', (chunk: Buffer) => {
      logger.debug(`[child] ${chunk.toString().trim()}`);
    });

    // Cleanup
    ws.on('close', () => {
      logger.info('Client disconnected, killing child');
      child.kill();
    });

    child.on('exit', (code, signal) => {
      logger.info(`Child exited code=${code} signal=${signal}`);
      if (ws.readyState === WebSocket.OPEN) ws.close();
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket error: ${err.message}`);
    });
  });

  httpServer.listen(config.port, () => {
    const proto = config.tlsCertPath ? 'wss' : 'ws';
    logger.info(`claude-agent-acp server listening on ${proto}://0.0.0.0:${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => shutdown(httpServer, wss));
  process.on('SIGINT', () => shutdown(httpServer, wss));
}

function shutdown(server: ReturnType<typeof createServer>, wss: WebSocketServer): void {
  logger.info('Shutting down...');
  wss.clients.forEach((ws) => ws.close());
  server.close(() => process.exit(0));
}
