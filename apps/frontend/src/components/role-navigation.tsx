'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { filterNavItems } from '../lib/roles';
import { useAuthUser } from './role-provider';

export function RoleNavigation() {
  const { authUser } = useAuthUser();
  const pathname = usePathname();
  // Never expose admin navigation unless the authenticated user is actually an admin.
  const role = authUser?.role === 'admin' ? 'admin' : 'user';
  const navItems = filterNavItems(role);

  return (
    <nav className="nav-pillbar" aria-label="Primary navigation" data-role={role}>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className="nav-pill" data-active={pathname === item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}