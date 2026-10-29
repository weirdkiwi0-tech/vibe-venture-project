import type { ReactNode } from 'react';
import { RoleNavigation } from './role-navigation';

export function SiteShell({ children }: { title: string; description: string; children: ReactNode; }) {
  return (
    <div className="page-shell">
      <RoleNavigation />
      <main className="content-grid">{children}</main>
    </div>
  );
}