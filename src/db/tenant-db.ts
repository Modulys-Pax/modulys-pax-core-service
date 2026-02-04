import { Client } from 'pg';
import config from 'config';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tenant-db');

interface AdminApiConfig {
  url: string;
  serviceKey: string;
}

const adminApiConfig = config.get<AdminApiConfig>('adminApi');

const connectionCache = new Map<string, { connectionString: string; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Obtém a connection string do tenant via Admin API (core: todo tenant provisionado tem core).
 */
export async function getTenantConnectionString(tenantId: string): Promise<string> {
  const cached = connectionCache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.connectionString;
  }

  const url = `${adminApiConfig.url.replace(/\/$/, '')}/provisioning/tenant/${tenantId}/connection`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-service-key': adminApiConfig.serviceKey,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    log.warn({ tenantId, status: response.status, err }, 'Failed to get tenant connection');
    throw new Error(`Tenant connection unavailable: ${response.status}`);
  }

  const data = (await response.json()) as { connectionString: string };
  connectionCache.set(tenantId, { connectionString: data.connectionString, fetchedAt: Date.now() });
  return data.connectionString;
}

export async function withTenantDb<T>(
  tenantId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const connectionString = await getTenantConnectionString(tenantId);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}
