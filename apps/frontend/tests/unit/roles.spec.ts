import { canAccessRole, filterNavItems, parseUserRole } from '../../src/lib/roles';

describe('roles utilities', () => {
  it('parses unknown values as user', () => {
    expect(parseUserRole(undefined)).toBe('user');
    expect(parseUserRole('admin')).toBe('admin');
    expect(parseUserRole('broken')).toBe('user');
  });

  it('filters navigation items by role', () => {
    expect(filterNavItems('user').some((item) => item.href === '/admin')).toBe(false);
    expect(filterNavItems('admin').some((item) => item.href === '/admin')).toBe(true);
  });

  it('checks role access directly', () => {
    expect(canAccessRole(['admin'], 'user')).toBe(false);
    expect(canAccessRole(['admin'], 'admin')).toBe(true);
  });
});