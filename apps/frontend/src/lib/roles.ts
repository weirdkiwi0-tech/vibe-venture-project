export type UserRole = 'user' | 'admin';

export const ROLE_COOKIE_NAME = 'keepit-role';

export const NAV_ITEMS = [
  { href: '/', label: '홈', roles: ['user', 'admin'] as const },
  { href: '/videos/new', label: '영상찍기', roles: ['user', 'admin'] as const },
  { href: '/videos', label: '풀이영상', roles: ['user', 'admin'] as const },
  { href: '/community', label: '커뮤니티', roles: ['user', 'admin'] as const },
  { href: '/mailbox', label: '우편함', roles: ['user', 'admin'] as const },
  { href: '/questions', label: '질문 목록', roles: ['user', 'admin'] as const },
  { href: '/questions/new', label: '질문 작성', roles: ['user', 'admin'] as const },
  { href: '/settings', label: '설정', roles: ['user', 'admin'] as const },
  { href: '/profile', label: '내 프로필', roles: ['user', 'admin'] as const },
  { href: '/admin', label: '운영자', roles: ['admin'] as const },
] as const;

export function parseUserRole(input: unknown): UserRole {
  if (typeof input !== 'string') {
    return 'user';
  }

  if (input === 'user' || input === 'admin') {
    return input;
  }

  return 'user';
}

export function canAccessRole(requiredRoles: readonly UserRole[], currentRole: UserRole) {
  return requiredRoles.includes(currentRole);
}

export function filterNavItems(currentRole: UserRole) {
  return NAV_ITEMS.filter((item) => canAccessRole(item.roles, currentRole));
}