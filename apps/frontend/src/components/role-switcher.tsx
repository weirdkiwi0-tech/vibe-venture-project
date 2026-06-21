'use client';

import Link from 'next/link';
import { useAuthUser } from './role-provider';

export function RoleSwitcher() {
  const { authUser, authResolved } = useAuthUser();

  return (
    <div className="role-switcher-wrap">
      <div className="auth-actions">
        {!authResolved ? (
          <span className="auth-status">로그인 상태 확인 중...</span>
        ) : authUser ? (
          <span className="auth-status">{authUser.displayName} 님</span>
        ) : (
          <Link className="primary-button" href="/profile">
            로그인 / 회원가입
          </Link>
        )}
      </div>
    </div>
  );
}