import type { FastifyInstance } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:roles');

function getTenantId(request: any): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) throw new Error('Missing x-tenant-id header');
  return tenantId;
}

export async function registerRoleRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { companyId?: string } }>('/roles', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { companyId } = request.query || {};
    try {
      const roles = await withTenantDb(tenantId, async (client) => {
        const query = companyId
          ? `SELECT id, name, description, "isActive", "companyId", "createdAt", "updatedAt" FROM roles WHERE "companyId" = $1 ORDER BY "createdAt" DESC`
          : `SELECT id, name, description, "isActive", "companyId", "createdAt", "updatedAt" FROM roles ORDER BY "createdAt" DESC`;
        const params = companyId ? [companyId] : [];
        const res = await client.query(query, params);
        return res.rows;
      });
      return reply.code(200).send({ roles, count: roles.length });
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List roles failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.get<{ Params: { id: string } }>('/roles/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const role = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, description, "isActive", "companyId", "createdAt", "updatedAt" FROM roles WHERE id = $1`,
          [id],
        );
        return res.rows[0];
      });
      if (!role) return reply.code(404).send({ error: 'Role not found' });
      return reply.code(200).send(role);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Get role failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.post<{
    Body: { name: string; companyId: string; description?: string };
  }>('/roles', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = request.body || {};
    const { name, companyId, description } = body;
    if (!name || !companyId) {
      return reply.code(400).send({ error: 'name and companyId are required' });
    }
    try {
      const role = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO roles (name, "companyId", description)
           VALUES ($1, $2, $3)
           RETURNING id, name, description, "isActive", "companyId", "createdAt", "updatedAt"`,
          [name, companyId, description || null],
        );
        return res.rows[0];
      });
      return reply.code(201).send(role);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Create role failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  log.info('Role routes registered');
}
