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

interface AdminApiConfig {
  url: string;
  serviceKey: string;
}

async function initialize(): Promise<void> {
  const serviceConfig = config.get<ServiceConfig>('service');
  const adminApiConfig = config.get<AdminApiConfig>('adminApi');

  log.info('Initializing Modulys Pax Core Service...');

  app = fastify({ logger: false, trustProxy: true });

  const corsOrigin =
    process.env.NODE_ENV === 'production' && process.env.PAX_CORS_ORIGIN?.trim()
      ? process.env.PAX_CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
      : true;
  await app.register(cors, { origin: corsOrigin, credentials: true });

  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || request.routerPath === '/health') return;
    const key = request.headers['x-service-key'];
    if (!adminApiConfig.serviceKey || key !== adminApiConfig.serviceKey) {
      return reply.code(401).send({ message: 'Unauthorized', code: 'MISSING_OR_INVALID_SERVICE_KEY' });
    }
  });

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
