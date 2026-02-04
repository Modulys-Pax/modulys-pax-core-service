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

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      description: string;
      isActive: boolean;
      companyId: string;
    }>;
  }>('/roles/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    const body = (request.body || {}) as Record<string, unknown>;
    const allowed = ['name', 'description', 'isActive', 'companyId'];
    const setKeys = Object.keys(body).filter((k) => allowed.includes(k));
    if (setKeys.length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' });
    }
    try {
      const role = await withTenantDb(tenantId, async (client) => {
        const setClause = setKeys.map((k, i) => `"${k === 'companyId' ? 'companyId' : k === 'isActive' ? 'isActive' : k}" = $${i + 1}`).join(', ');
        const values = setKeys.map((k) => body[k]);
        const res = await client.query(
          `UPDATE roles SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${setKeys.length + 1} RETURNING id, name, description, "isActive", "companyId", "createdAt", "updatedAt"`,
          [...values, id],
        );
        return res.rows[0];
      });
      if (!role) return reply.code(404).send({ error: 'Role not found' });
      return reply.code(200).send(role);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Update role failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.delete<{ Params: { id: string } }>('/roles/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const deleted = await withTenantDb(tenantId, async (client) => {
        const res = await client.query('DELETE FROM roles WHERE id = $1 RETURNING id', [id]);
        return res.rowCount ?? 0;
      });
      if (deleted === 0) return reply.code(404).send({ error: 'Role not found' });
      return reply.code(204).send();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      log.error({ error: e, tenantId }, 'Delete role failed');
      return reply.code(500).send({ error: err?.message || 'Internal error' });
    }
  });

  log.info('Role routes registered');
}
