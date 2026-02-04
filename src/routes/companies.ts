import type { FastifyInstance } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:companies');

function getTenantId(request: any): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) throw new Error('Missing x-tenant-id header');
  return tenantId;
}

export async function registerCompanyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/companies', async (request, reply) => {
    const tenantId = getTenantId(request);
    try {
      const companies = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, "tradeName", document, email, phone, address, city, state, "zipCode", "isActive", "createdAt", "updatedAt"
           FROM companies ORDER BY "createdAt" DESC`,
        );
        return res.rows;
      });
      return reply.code(200).send({ companies, count: companies.length });
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List companies failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.get<{ Params: { id: string } }>('/companies/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const company = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, "tradeName", document, email, phone, address, city, state, "zipCode", "isActive", "createdAt", "updatedAt"
           FROM companies WHERE id = $1`,
          [id],
        );
        return res.rows[0];
      });
      if (!company) return reply.code(404).send({ error: 'Company not found' });
      return reply.code(200).send(company);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Get company failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.post<{
    Body: {
      name: string;
      document: string;
      email: string;
      tradeName?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    };
  }>('/companies', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = request.body || {};
    const { name, document, email, tradeName, phone, address, city, state, zipCode } = body;
    if (!name || !document || !email) {
      return reply.code(400).send({ error: 'name, document and email are required' });
    }
    try {
      const company = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO companies (name, document, email, "tradeName", phone, address, city, state, "zipCode")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, "tradeName", document, email, phone, address, city, state, "zipCode", "isActive", "createdAt", "updatedAt"`,
          [name, document, email, tradeName || null, phone || null, address || null, city || null, state || null, zipCode || null],
        );
        return res.rows[0];
      });
      return reply.code(201).send(company);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Create company failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  log.info('Company routes registered');
}
