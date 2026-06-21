'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAuthMe, getLogoutUrl } from '../lib/api';
import { parseUserRole, type UserRole, ROLE_COOKIE_NAME } from '../lib/roles';

interface RoleContextValue {
  role: UserRole;
  authUser: {
    id: string;
    email: string;
    displayName: string;
    photoUrl?: string;
    role: UserRole;
  } | null;
  authResolved: boolean;
  refetchAuth: () => Promise<void>;
}

interface BanState {
  isBanned: boolean;
  bannedUntil: string | null;
  remainingSeconds: number;
  logoutAfterSeconds: number;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function persistRole(role: UserRole) {
  document.cookie = `${ROLE_COOKIE_NAME}=${role}; path=/; max-age=31536000; samesite=lax`;
}

export function RoleProvider({ initialRole, children }: { initialRole: UserRole; children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(parseUserRole(initialRole));
  const [authUser, setAuthUser] = useState<RoleContextValue['authUser']>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [banState, setBanState] = useState<BanState | null>(null);
  const [logoutCountdown, setLogoutCountdown] = useState<number | null>(null);

  const fetchAuth = useCallback(async () => {
    try {
      const result = await getAuthMe();
      if (result.isAuthenticated && result.user) {
        const normalizedRole = parseUserRole(result.user.role);
        setAuthUser({ ...result.user, role: normalizedRole });
        setRoleState(normalizedRole);
        if (result.ban?.isBanned) {
          setBanState(result.ban);
          setLogoutCountdown((prev) => prev ?? result.ban?.logoutAfterSeconds ?? 10);
        } else {
          setBanState(null);
          setLogoutCountdown(null);
        }
      } else {
        setAuthUser(null);
        setBanState(null);
        setLogoutCountdown(null);
      }
    } catch {
      setAuthUser(null);
      setBanState(null);
      setLogoutCountdown(null);
    } finally {
      setAuthResolved(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    void fetchAuth().then(() => {
      if (!mounted) {
        return;
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchAuth();
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authUser, fetchAuth]);

  useEffect(() => {
    if (!banState?.isBanned || logoutCountdown === null) {
      return;
    }

    if (logoutCountdown <= 0) {
      window.location.href = getLogoutUrl();
      return;
    }

    const timer = window.setTimeout(() => {
      setLogoutCountdown((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [banState, logoutCountdown]);

  useEffect(() => {
    persistRole(role);
  }, [role]);

  const value = useMemo(
    () => ({
      role,
      authUser,
      authResolved,
      refetchAuth: fetchAuth,
    }),
    [authResolved, authUser, role],
  );

  const bannedUntilText = banState?.bannedUntil
    ? new Date(banState.bannedUntil).toLocaleString('ko-KR')
    : '-';

  const remainingBanText = (() => {
    if (!banState?.remainingSeconds || banState.remainingSeconds <= 0) {
      return '0초';
    }

    const total = banState.remainingSeconds;
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}일`);
    if (hours > 0) parts.push(`${hours}시간`);
    if (minutes > 0) parts.push(`${minutes}분`);
    if (seconds > 0) parts.push(`${seconds}초`);
    return parts.join(' ');
  })();

  return (
    <RoleContext.Provider value={value}>
      {children}
      {banState?.isBanned ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <section
            style={{
              width: 'min(560px, 100%)',
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 10px', color: '#9f1239' }}>계정이 밴 상태입니다</h2>
            <p style={{ margin: '0 0 8px' }}>해당 계정은 운영자에 의해 제한되었습니다.</p>
            <p style={{ margin: '0 0 6px' }}>밴 해제 시각: {bannedUntilText}</p>
            <p style={{ margin: '0 0 16px' }}>남은 밴 시간: {remainingBanText}</p>
            <p style={{ margin: 0, fontWeight: 700 }}>보안을 위해 {logoutCountdown ?? 0}초 후 자동 로그아웃됩니다.</p>
          </section>
        </div>
      ) : null}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }

  return context.role;
}

export function useAuthUser() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useAuthUser must be used within RoleProvider');
  }

  return {
    authUser: context.authUser,
    authResolved: context.authResolved,
    refetchAuth: context.refetchAuth,
  };
}