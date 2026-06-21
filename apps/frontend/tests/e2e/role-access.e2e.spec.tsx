import { render, screen } from '@testing-library/react';
import { RoleProvider } from '../../src/components/role-provider';
import { RoleGate } from '../../src/components/role-gate';
import { RoleNavigation } from '../../src/components/role-navigation';
import { RoleSwitcher } from '../../src/components/role-switcher';
import { getAuthMe } from '../../src/lib/api';

jest.mock('../../src/lib/api', () => ({
  getAuthMe: jest.fn().mockResolvedValue({ isAuthenticated: false }),
  getGoogleAuthUrl: jest.fn(() => '/auth/google'),
  getLogoutUrl: jest.fn(() => '/auth/logout'),
}));

const mockedGetAuthMe = getAuthMe as jest.MockedFunction<typeof getAuthMe>;

beforeEach(() => {
  mockedGetAuthMe.mockResolvedValue({ isAuthenticated: false });
});

describe('role access e2e', () => {
  it('gates admin-only content by user/admin role', async () => {
    const firstRender = render(
      <RoleProvider initialRole="user">
        <RoleSwitcher />
        <RoleNavigation />
        <RoleGate allowedRoles={['admin']} fallback={<div>no-admin</div>}>
          <div>admin-only</div>
        </RoleGate>
      </RoleProvider>,
    );

    await screen.findByText('로그인 / 회원가입');

    expect(screen.getByText('no-admin')).toBeInTheDocument();
    expect(screen.queryByText('운영자')).not.toBeInTheDocument();

    firstRender.unmount();

    mockedGetAuthMe.mockResolvedValue({
      isAuthenticated: true,
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        displayName: 'Admin',
        role: 'admin',
      },
    });

    render(
      <RoleProvider initialRole="admin">
        <RoleSwitcher />
        <RoleNavigation />
        <RoleGate allowedRoles={['admin']} fallback={<div>no-admin</div>}>
          <div>admin-only</div>
        </RoleGate>
      </RoleProvider>,
    );

    await screen.findByText('Admin 님');

    expect(screen.getByText('admin-only')).toBeInTheDocument();
    expect(screen.getByText('운영자')).toBeInTheDocument();
  });

  it('shows google login entry when not authenticated', async () => {
    render(
      <RoleProvider initialRole="user">
        <RoleSwitcher />
      </RoleProvider>,
    );

    expect(await screen.findByText('로그인 / 회원가입')).toBeInTheDocument();
  });
});