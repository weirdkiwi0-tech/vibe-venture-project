export type UserRole = 'user' | 'admin';

export const ROLE_METADATA_KEY = 'roles';

export function parseUserRole(input: unknown): UserRole {
  if (typeof input !== 'string') {
    return 'user';
  }

  if (input === 'user' || input === 'admin') {
    return input;
  }

  return 'user';
}