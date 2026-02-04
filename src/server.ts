import { fastify, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import config from 'config';
import { createLogger } from './utils/logger.js';
import { registerRoutes } from './routes/index.js';

const log = createLogger('modulys-pax-core-service');

interface ServiceConfig {
  host: string;
  port: number;
}

let app: FastifyInstance;

async function initialize(): Promise<void> {
  const serviceConfig = config.get<ServiceConfig>('service');

  log.info('Initializing Modulys Pax Core Service...');

  app = fastify({ logger: false, trustProxy: true });

  await app.register(cors, { origin: true, credentials: true });

  await registerRoutes(app);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'modulys-pax-core-service',
    timestamp: new Date().toISOString(),
  }));

  await app.listen({ host: serviceConfig.host, port: serviceConfig.port });

  log.info({ host: serviceConfig.host, port: serviceConfig.port }, 'Modulys Pax Core Service started');
}

initialize().catch((err) => {
  log.error({ err }, 'Failed to start');
  process.exit(1);
});
