import pino from 'pino';
import config from 'config';

interface LoggerConfig {
  level: string;
  prettyPrint: boolean;
}

const loggerConfig = config.get<LoggerConfig>('logger');

export function createLogger(name: string): pino.Logger {
  return pino({
    name,
    level: loggerConfig.level,
    ...(loggerConfig.prettyPrint && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    }),
  });
}
