import type { FastifyInstance } from 'fastify';
import { withTenantDb } from '../db/tenant-db.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('routes:employees');

function getTenantId(request: any): string {
  const tenantId = request.headers['x-tenant-id'] as string;
  if (!tenantId) throw new Error('Missing x-tenant-id header');
  return tenantId;
}

export async function registerEmployeeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { companyId?: string; branchId?: string } }>('/employees', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { companyId, branchId } = request.query || {};
    try {
      const employees = await withTenantDb(tenantId, async (client) => {
        let query = `SELECT id, name, email, cpf, phone, "birthDate", registration, position, department, "hireDate", "terminationDate", "isActive", "hasSystemAccess", "lastLoginAt", "companyId", "branchId", "roleId", "createdAt", "updatedAt" FROM employees WHERE 1=1`;
        const params: string[] = [];
        let i = 1;
        if (companyId) {
          query += ` AND "companyId" = $${i++}`;
          params.push(companyId);
        }
        if (branchId) {
          query += ` AND "branchId" = $${i++}`;
          params.push(branchId);
        }
        query += ` ORDER BY "createdAt" DESC`;
        const res = await client.query(query, params);
        return res.rows;
      });
      return reply.code(200).send({ employees, count: employees.length });
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'List employees failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.get<{ Params: { id: string } }>('/employees/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const employee = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `SELECT id, name, email, cpf, phone, "birthDate", registration, position, department, "hireDate", "terminationDate", "isActive", "hasSystemAccess", "lastLoginAt", "companyId", "branchId", "roleId", "createdAt", "updatedAt" FROM employees WHERE id = $1`,
          [id],
        );
        return res.rows[0];
      });
      if (!employee) return reply.code(404).send({ error: 'Employee not found' });
      return reply.code(200).send(employee);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Get employee failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.post<{
    Body: {
      name: string;
      email: string;
      cpf: string;
      companyId: string;
      branchId: string;
      phone?: string;
      birthDate?: string;
      registration?: string;
      position?: string;
      department?: string;
      roleId?: string;
    };
  }>('/employees', async (request, reply) => {
    const tenantId = getTenantId(request);
    const body = request.body || {};
    const { name, email, cpf, companyId, branchId, phone, birthDate, registration, position, department, roleId } = body;
    if (!name || !email || !cpf || !companyId || !branchId) {
      return reply.code(400).send({ error: 'name, email, cpf, companyId and branchId are required' });
    }
    try {
      const employee = await withTenantDb(tenantId, async (client) => {
        const res = await client.query(
          `INSERT INTO employees (name, email, cpf, "companyId", "branchId", phone, "birthDate", registration, position, department, "roleId")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, name, email, cpf, phone, "birthDate", registration, position, department, "hireDate", "terminationDate", "isActive", "hasSystemAccess", "companyId", "branchId", "roleId", "createdAt", "updatedAt"`,
          [name, email, cpf, companyId, branchId, phone || null, birthDate ? new Date(birthDate) : null, registration || null, position || null, department || null, roleId || null],
        );
        return res.rows[0];
      });
      return reply.code(201).send(employee);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Create employee failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      email: string;
      cpf: string;
      companyId: string;
      branchId: string;
      phone: string;
      birthDate: string;
      registration: string;
      position: string;
      department: string;
      roleId: string;
      isActive: boolean;
    }>;
  }>('/employees/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    const body = (request.body || {}) as Record<string, unknown>;
    const allowed = ['name', 'email', 'cpf', 'companyId', 'branchId', 'phone', 'birthDate', 'registration', 'position', 'department', 'roleId', 'isActive'];
    const setKeys = Object.keys(body).filter((k) => allowed.includes(k));
    if (setKeys.length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' });
    }
    try {
      const employee = await withTenantDb(tenantId, async (client) => {
        const setParts = setKeys.map((k, i) => {
          const col = k === 'companyId' ? 'companyId' : k === 'branchId' ? 'branchId' : k === 'roleId' ? 'roleId' : k === 'birthDate' ? 'birthDate' : k === 'isActive' ? 'isActive' : k;
          return `"${col}" = $${i + 1}`;
        });
        const setClause = setParts.join(', ');
        const values = setKeys.map((k) => {
          const v = body[k];
          if (k === 'birthDate' && v != null) return new Date(v as string);
          return v;
        });
        const res = await client.query(
          `UPDATE employees SET ${setClause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $${setKeys.length + 1} RETURNING id, name, email, cpf, phone, "birthDate", registration, position, department, "hireDate", "terminationDate", "isActive", "hasSystemAccess", "companyId", "branchId", "roleId", "createdAt", "updatedAt"`,
          [...values, id],
        );
        return res.rows[0];
      });
      if (!employee) return reply.code(404).send({ error: 'Employee not found' });
      return reply.code(200).send(employee);
    } catch (e: any) {
      log.error({ error: e, tenantId }, 'Update employee failed');
      return reply.code(500).send({ error: e.message || 'Internal error' });
    }
  });

  app.delete<{ Params: { id: string } }>('/employees/:id', async (request, reply) => {
    const tenantId = getTenantId(request);
    const { id } = request.params;
    try {
      const deleted = await withTenantDb(tenantId, async (client) => {
        const res = await client.query('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);
        return res.rowCount ?? 0;
      });
      if (deleted === 0) return reply.code(404).send({ error: 'Employee not found' });
      return reply.code(204).send();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === '23503') {
        return reply.code(409).send({ error: 'Employee has related records and cannot be deleted' });
      }
      log.error({ error: e, tenantId }, 'Delete employee failed');
      return reply.code(500).send({ error: err?.message || 'Internal error' });
    }
  });

  log.info('Employee routes registered');
}
