import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { deserialize, serialize } from 'node:v8';
import { types } from 'node:util';

export function attachLocalState(
  target: object,
  name: string,
  fields: string[],
  mutations: string[],
  prototypes: Record<string, object> = {},
): void {
  if (process.env.AZURE_TABLES_CONNECTION_STRING || process.env.LOCAL_PERSISTENCE === 'off') return;
  if (process.env.NODE_ENV === 'test' && !process.env.LOCAL_STATE_DIR) return;
  const directory = process.env.LOCAL_STATE_DIR ?? (process.env.DB_PATH ? `${resolve(process.env.DB_PATH)}.state` : resolve(process.cwd(), 'data/state'));
  const path = resolve(directory, `${name}.bin`);
  const state = target as Record<string, unknown>;
  if (existsSync(path)) {
    const stored = deserialize(readFileSync(path)) as { version: number; state: Record<string, unknown> };
    if (stored.version !== 1 || !stored.state) throw new Error(`Unsupported local state: ${name}`);
    for (const field of fields) {
      if (!(field in stored.state)) throw new Error(`Missing local state field: ${name}.${field}`);
      state[field] = stored.state[field];
      const prototype = prototypes[field];
      const collection = state[field];
      if (prototype && types.isMap(collection)) {
        for (const value of collection.values()) Object.setPrototypeOf(value, prototype);
      }
    }
  }
  const persist = () => {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    const payload = serialize({ version: 1, state: Object.fromEntries(fields.map(field => [field, state[field]])) });
    const descriptor = openSync(temporary, 'wx', 0o600);
    try {
      writeFileSync(descriptor, payload);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, path);
  };
  for (const method of mutations) {
    const original = state[method];
    if (typeof original !== 'function') throw new Error(`Unknown mutation: ${name}.${method}`);
    Object.defineProperty(target, method, {
      configurable: true,
      value: (...args: unknown[]) => {
        const result = original.apply(target, args);
        if (result instanceof Promise) return result.then(value => { persist(); return value; });
        persist();
        return result;
      },
    });
  }
}