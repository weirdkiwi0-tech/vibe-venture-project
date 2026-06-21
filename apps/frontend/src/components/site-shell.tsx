import type { ReactNode } from 'react';
import { RoleNavigation } from './role-navigation';
import { RoleSwitcher } from './role-switcher';

export function SiteShell({ title, description, children }: { title: string; description: string; children: ReactNode; }) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <div className="brand">KeepIt</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="topbar-actions">
          <form method="get" action="/search" className="global-search-form" role="search" aria-label="통합 검색">
            <input
              type="search"
              name="q"
              placeholder="통합 검색: 질문/커뮤니티/풀이영상"
              className="global-search-input"
            />
            <button type="submit" className="secondary-button global-search-button">검색</button>
          </form>
          <RoleSwitcher />
        </div>
      </header>
      <main className="content-grid">{children}</main>
      <div className="bottom-nav-shell" aria-label="Bottom navigation">
        <RoleNavigation />
      </div>
    </div>
  );
}