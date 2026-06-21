import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { RoleProvider } from '../components/role-provider';
import { parseUserRole, ROLE_COOKIE_NAME } from '../lib/roles';

export const metadata = {
  title: 'KeepIt',
  description: 'KeepIt frontend for students, mentors, and admins',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const roleCookie = (await cookies()).get(ROLE_COOKIE_NAME)?.value;
  const initialRole = parseUserRole(roleCookie);

  return (
    <html lang="ko">
      <body>
        <RoleProvider initialRole={initialRole}>{children}</RoleProvider>
      </body>
    </html>
  );
}
