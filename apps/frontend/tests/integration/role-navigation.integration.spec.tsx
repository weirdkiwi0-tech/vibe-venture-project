import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  HTMLDialogElement.prototype.showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = jest.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
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
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    expect(screen.queryByText('운영자')).not.toBeInTheDocument();
    expect(screen.queryByText('개발자')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '우편함' })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    expect(screen.getByText('운영자')).toBeInTheDocument();
    expect(screen.getByText('개발자')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '개발자' })).toHaveAttribute('href', '/developer');
  });

  it('opens the drawer and closes it with its button, backdrop, and navigation links', async () => {
    render(<RoleProvider initialRole="user"><RoleSwitcher /><RoleNavigation /></RoleProvider>);
    await screen.findByText('로그인 / 회원가입');
    const trigger = screen.getByRole('button', { name: '메뉴 열기' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: '사이트 메뉴' })).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }));
    expect(screen.getByRole('dialog', { name: '사이트 메뉴' })).toHaveAttribute('data-closing', 'true');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('dialog'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('link', { name: '풀이영상' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('lists questions before videos and settings after profile', async () => {
    render(<RoleProvider initialRole="user"><RoleSwitcher /><RoleNavigation /></RoleProvider>);
    await screen.findByText('로그인 / 회원가입');
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const labels = screen.getAllByRole('link').map((link) => link.textContent);
    expect(labels.indexOf('질문 목록')).toBeLessThan(labels.indexOf('풀이영상'));
    expect(labels.indexOf('설정')).toBeGreaterThan(labels.indexOf('내 프로필'));
  });
});