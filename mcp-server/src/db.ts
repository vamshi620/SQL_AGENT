import { createRequire } from 'node:module';
import { getDbConfig } from './config.js';

const require = createRequire(import.meta.url);

/**
 * Gets the configured mssql module dynamically.
 * If DB_TRUSTED_CONNECTION is true, loads the msnodesqlv8 driver version for Windows Auth.
 * Otherwise, loads the standard tedious version.
 */
export function getSqlModule() {
  const isTrusted = process.env.DB_TRUSTED_CONNECTION === 'true';
  if (isTrusted) {
    return require('mssql/msnodesqlv8');
  } else {
    return require('mssql');
  }
}

/**
 * Creates and returns a connected connection pool.
 * Handles Windows Integrated Authentication (trusted connection) vs SQL Server Authentication.
 */
export async function connectToDb(databaseOverride?: string) {
  const sql = getSqlModule();
  const config = getDbConfig();
  
  const isTrusted = process.env.DB_TRUSTED_CONNECTION === 'true';
  
  let serverHost = config.server;
  let instanceName: string | undefined = undefined;
  
  if (serverHost.includes('\\')) {
    const parts = serverHost.split('\\');
    serverHost = parts[0];
    instanceName = parts[1];
  }
  
  const isLocalhost = serverHost.toLowerCase() === 'localhost' || serverHost === '127.0.0.1';

  const connectionConfig: any = {
    server: serverHost,
    database: databaseOverride || config.database,
    options: {
      encrypt: config.options.encrypt,
      trustServerCertificate: config.options.trustServerCertificate,
    }
  };

  // If it is localhost, do not specify any port or instanceName to allow direct connection.
  // Otherwise, set the port and instanceName if they were configured/provided.
  if (!isLocalhost) {
    if (config.port !== undefined) {
      connectionConfig.port = config.port;
    }
    if (instanceName) {
      connectionConfig.options.instanceName = instanceName;
    }
  } else {
    // If localhost was specified with a named instance (e.g. localhost\SQLEXPRESS), respect it.
    if (instanceName) {
      connectionConfig.options.instanceName = instanceName;
    }
  }

  if (isTrusted) {
    connectionConfig.driver = 'msnodesqlv8';
    connectionConfig.options.trustedConnection = true;

    // Use a custom ODBC driver name (defaults to ODBC Driver 17 for SQL Server, which is installed)
    const odbcDriver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
    let serverStr = serverHost;

    if (!isLocalhost) {
      if (instanceName) {
        serverStr = `${serverHost}\\${instanceName}`;
      } else if (config.port !== undefined) {
        serverStr = `${serverHost},${config.port}`;
      }
    } else {
      if (instanceName) {
        serverStr = `${serverHost}\\${instanceName}`;
      }
    }

    let connStr = `Driver={${odbcDriver}};Server=${serverStr};Database=${databaseOverride || config.database};Trusted_Connection=Yes;`;
    if (config.options.encrypt) {
      connStr += 'Encrypt=Yes;';
    }
    if (config.options.trustServerCertificate) {
      connStr += 'TrustServerCertificate=Yes;';
    }

    connectionConfig.connectionString = connStr;
  } else {
    connectionConfig.user = config.user;
    connectionConfig.password = config.password;
  }

  return await sql.connect(connectionConfig);
}
