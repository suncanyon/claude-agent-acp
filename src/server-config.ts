export interface ServerConfig {
  port: number;
  authToken: string | undefined;
  claudeAgentCmd: string;
  claudeAgentArgs: string[];
  tlsCertPath: string | undefined;
  tlsKeyPath: string | undefined;
  maxConnections: number;
  logLevel: string;
}

export function loadServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT ?? '18790', 10),
    authToken: process.env.AUTH_TOKEN,
    claudeAgentCmd: process.env.CLAUDE_AGENT_CMD ?? process.execPath,
    claudeAgentArgs: process.env.CLAUDE_AGENT_ARGS?.split(' ').filter(Boolean) ?? [...process.argv.slice(1).filter(a => a !== '--server')],
    tlsCertPath: process.env.TLS_CERT_PATH,
    tlsKeyPath: process.env.TLS_KEY_PATH,
    maxConnections: parseInt(process.env.MAX_CONNECTIONS ?? '10', 10),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
