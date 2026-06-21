import { render, screen } from '@testing-library/react';
import { RoleProvider } from '../../src/components/role-provider';
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

describe('role navigation integration', () => {
  it('hides admin navigation for general users', async () => {
    mockedGetAuthMe.mockResolvedValue({ isAuthenticated: false });

    render(
      <RoleProvider initialRole="user">
        <RoleSwitcher />
        <RoleNavigation />
      </RoleProvider>,
    );

    await screen.findByText('로그인 / 회원가입');

    expect(screen.queryByText('운영자')).not.toBeInTheDocument();
  });

  it('shows admin navigation for admin users', async () => {
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
      </RoleProvider>,
    );

    await screen.findByText('Admin 님');

    expect(screen.getByText('운영자')).toBeInTheDocument();
  });
});