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

  log.info('Employee routes registered');
}
