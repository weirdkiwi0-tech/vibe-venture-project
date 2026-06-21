'use client';

import type { ReactNode } from 'react';
import { canAccessRole, type UserRole } from '../lib/roles';
import { useRole } from './role-provider';

export function RoleGate({ allowedRoles, fallback = null, children }: { allowedRoles: UserRole[]; fallback?: ReactNode; children: ReactNode; }) {
  const role = useRole();
  const isAllowed = canAccessRole(allowedRoles, role);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}