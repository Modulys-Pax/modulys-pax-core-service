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

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      code: string;
      companyId: string;
      address: string;
      city: string;
      state: string;
      isActive: boolean;
    }>;
  }>('/branches/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    const body = (request.body || {}) as Record<string, unknown>;
    const allowed = ['name', 'code', 'companyId', 'address', 'city', 'state', 'isActive'];
    const setKeys = Object.keys(body).filter((k) => allowed.includes(k));
    if (setKeys.length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' });
    }
    try {
      const branch = await withTenantDb(tenantId, async (client) => {
        const setClause = setKeys.map((k, i) => `"${k === 'companyId' ? 'companyId' : k === 'isActive' ? 'isActive' : k}" = $${i + 1}`).join(', ');
        const values = setKeys.map((k) => body[k]);
        const res = await client.query(
          `UPDATE branches SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${setKeys.length + 1} RETURNING id, name, code, address, city, state, "isActive", "companyId", "createdAt", "updatedAt"`,
          [...values, id],
        );
        return res.rows[0];
      });
      if (!branch) return reply.code(404).send({ error: 'Branch not found' });
      return reply.code(200).send(branch);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Update branch failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.delete<{ Params: { id: string } }>('/branches/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const deleted = await withTenantDb(tenantId, async (client) => {
        const res = await client.query('DELETE FROM branches WHERE id = $1 RETURNING id', [id]);
        return res.rowCount ?? 0;
      });
      if (deleted === 0) return reply.code(404).send({ error: 'Branch not found' });
      return reply.code(204).send();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === '23503') {
        return reply.code(409).send({ error: 'Branch has related employees and cannot be deleted' });
      }
      log.error({ error: e, tenantId }, 'Delete branch failed');
      return reply.code(500).send({ error: err?.message || 'Internal error' });
    }
  });

  log.info('Branch routes registered');
}
