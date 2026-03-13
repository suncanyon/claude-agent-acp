type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: Level = (process.env.LOG_LEVEL ?? 'info') as Level;

function log(level: Level, msg: string): void {
  if (LEVELS[level] >= LEVELS[currentLevel]) {
    const ts = new Date().toISOString();
    console.error(`[${ts}] [${level.toUpperCase()}] ${msg}`);
  }
}

export const logger = {
  debug: (msg: string) => log('debug', msg),
  info: (msg: string) => log('info', msg),
  warn: (msg: string) => log('warn', msg),
  error: (msg: string) => log('error', msg),
};
