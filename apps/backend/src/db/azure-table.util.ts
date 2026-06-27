import { BadRequestException } from '@nestjs/common';
import { TableClient } from '@azure/data-tables';

export function getTableClient(envVarName: string, defaultTableName: string): TableClient {
  const connectionString = process.env.AZURE_TABLES_CONNECTION_STRING;
  if (!connectionString) {
    throw new BadRequestException('AZURE_TABLES_CONNECTION_STRING이 필요합니다.');
  }

  const tableName = process.env[envVarName] ?? defaultTableName;
  return TableClient.fromConnectionString(connectionString, tableName);
}

export async function ensureTable(client: TableClient): Promise<void> {
  try {
    await client.createTable();
  } catch (error) {
    const message = String((error as { message?: string }).message ?? '').toLowerCase();
    if (!message.includes('tablealreadyexists')) {
      throw error;
    }
  }
}

export async function listAllEntities<T extends Record<string, unknown>>(client: TableClient, filter?: string): Promise<T[]> {
  const results: T[] = [];
  const entities = filter
    ? client.listEntities<T>({ queryOptions: { filter } })
    : client.listEntities<T>();

  for await (const entity of entities) {
    results.push(entity);
  }

  return results;
}

export function escapeOdataString(value: string): string {
  return value.replace(/'/g, "''");
}
