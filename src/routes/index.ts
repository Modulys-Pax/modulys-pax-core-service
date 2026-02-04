import type { FastifyInstance } from 'fastify';
import { registerCompanyRoutes } from './companies.js';
import { registerBranchRoutes } from './branches.js';
import { registerEmployeeRoutes } from './employees.js';
import { registerRoleRoutes } from './roles.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerCompanyRoutes(app);
  await registerBranchRoutes(app);
  await registerEmployeeRoutes(app);
  await registerRoleRoutes(app);
}
