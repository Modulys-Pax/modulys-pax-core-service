import type { FastifyInstance } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:branches');

function getTenantId(request: any): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) throw new Error('Missing x-tenant-id header');
  return tenantId;
}

export async function registerBranchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { companyId?: string } }>('/branches', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { companyId } = request.query || {};
    try {
      const branches = await withTenantDb(tenantId, async (client) => {
        const query = companyId
          ? `SELECT id, name, code, address, city, state, "isActive", "companyId", "createdAt", "updatedAt" FROM branches WHERE "companyId" = $1 ORDER BY "createdAt" DESC`
          : `SELECT id, name, code, address, city, state, "isActive", "companyId", "createdAt", "updatedAt" FROM branches ORDER BY "createdAt" DESC`;
        const params = companyId ? [companyId] : [];
        const res = await client.query(query, params);
        return res.rows;
      });
      return reply.code(200).send({ branches, count: branches.length });
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List branches failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.get<{ Params: { id: string } }>('/branches/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const branch = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, code, address, city, state, "isActive", "companyId", "createdAt", "updatedAt" FROM branches WHERE id = $1`,
          [id],
        );
        return res.rows[0];
      });
      if (!branch) return reply.code(404).send({ error: 'Branch not found' });
      return reply.code(200).send(branch);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Get branch failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.post<{
    Body: { name: string; code: string; companyId: string; address?: string; city?: string; state?: string };
  }>('/branches', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = request.body || {};
    const { name, code, companyId, address, city, state } = body;
    if (!name || !code || !companyId) {
      return reply.code(400).send({ error: 'name, code and companyId are required' });
    }
    try {
      const branch = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO branches (name, code, "companyId", address, city, state)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, name, code, address, city, state, "isActive", "companyId", "createdAt", "updatedAt"`,
          [name, code, companyId, address || null, city || null, state || null],
        );
        return res.rows[0];
      });
      return reply.code(201).send(branch);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Create branch failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  log.info('Branch routes registered');
}
