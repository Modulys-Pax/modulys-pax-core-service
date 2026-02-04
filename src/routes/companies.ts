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
          `INSERT INTO companies (name, document, email, "tradeName", phone, address, city, state, "zipCode", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
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

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      tradeName: string;
      document: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      isActive: boolean;
    }>;
  }>('/companies/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    const body = (request.body || {}) as Record<string, unknown>;
    const allowed = ['name', 'tradeName', 'document', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'isActive'];
    const setKeys = Object.keys(body).filter((k) => allowed.includes(k));
    if (setKeys.length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' });
    }
    try {
      const company = await withTenantDb(tenantId, async (client) => {
        const setClause = setKeys.map((k, i) => `"${k === 'isActive' ? 'isActive' : k}" = $${i + 1}`).join(', ');
        const values = setKeys.map((k) => body[k]);
        const res = await client.query(
          `UPDATE companies SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${setKeys.length + 1} RETURNING id, name, "tradeName", document, email, phone, address, city, state, "zipCode", "isActive", "createdAt", "updatedAt"`,
          [...values, id],
        );
        return res.rows[0];
      });
      if (!company) return reply.code(404).send({ error: 'Company not found' });
      return reply.code(200).send(company);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Update company failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.delete<{ Params: { id: string } }>('/companies/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const deleted = await withTenantDb(tenantId, async (client) => {
        const res = await client.query('DELETE FROM companies WHERE id = $1 RETURNING id', [id]);
        return res.rowCount ?? 0;
      });
      if (deleted === 0) return reply.code(404).send({ error: 'Company not found' });
      return reply.code(204).send();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === '23503') {
        return reply.code(409).send({ error: 'Company has related records and cannot be deleted' });
      }
      log.error({ error: e, tenantId }, 'Delete company failed');
      return reply.code(500).send({ error: err?.message || 'Internal error' });
    }
  });

  log.info('Company routes registered');
}
