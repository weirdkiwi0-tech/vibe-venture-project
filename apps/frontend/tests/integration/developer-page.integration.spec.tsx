import { render, screen, within } from '@testing-library/react';
import DeveloperPage from '../../src/app/developer/page';

const mockCookies = jest.fn();
const originalFetch = global.fetch;

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

jest.mock('../../src/components/site-shell', () => ({
  SiteShell: ({ children }: { children: unknown }) => <div>{children as never}</div>,
}));

jest.mock('../../src/components/section-card', () => ({
  SectionCard: ({ children }: { children: unknown }) => <section>{children as never}</section>,
}));

describe('developer page integration', () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({
      get: () => ({ value: 'session-token' }),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isAuthenticated: true,
        user: {
          role: 'admin',
        },
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders developer hub links for admin users', async () => {
    render(await DeveloperPage());

    expect(screen.getByText('운영자 대시보드')).toBeInTheDocument();
    expect(screen.getByText('신고 목록')).toBeInTheDocument();
    const adminCard = screen.getByText('운영자 대시보드').closest('article');
    expect(adminCard).not.toBeNull();
    expect(within(adminCard as HTMLElement).getByRole('link', { name: '이동' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: '백엔드 health 확인' })).toHaveAttribute('href', expect.stringContaining('/health'));
  });
});
