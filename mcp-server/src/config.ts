import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export const WORKSPACE_ROOT = resolve(__dirname, '../../');

// Load .env from the project root
loadEnv({ path: resolve(WORKSPACE_ROOT, '.env') });

export interface DbConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    trustedConnection?: boolean;
  };
}

/**
 * Builds the mssql connection config from environment variables.
 * Supports both SQL auth and Windows auth (trusted connection).
 */
export function getDbConfig(): DbConfig {
  const server = process.env.DB_SERVER;
  const database = process.env.DB_DATABASE;

  if (!server || !database) {
    throw new Error(
      'Missing required environment variables: DB_SERVER and DB_DATABASE must be set in your .env file.'
    );
  }

  const portVal = process.env.DB_PORT;

  return {
    server,
    port: portVal ? parseInt(portVal, 10) : undefined,
    database,
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
      trustedConnection: process.env.DB_TRUSTED_CONNECTION === 'true',
    },
  };
}

/**
 * Resolves the output directory for generated Word documents.
 * Forces it to be inside the consolidated workspace folder.
 */
export function getOutputDir(): string {
  return resolve(WORKSPACE_ROOT, 'workspace');
}

/**
 * Returns the schema used for isolated test deployments.
 */
export function getTestSchema(): string {
  return process.env.DB_TEST_SCHEMA ?? 'dbo_test';
}
