import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NewReportPage from '../../src/app/reports/new/page';
import { SettingsPanel } from '../../src/components/settings-panel';
import {
  COMMUNITY_PREFERENCES_STORAGE_KEY,
  DEFAULT_COMMUNITY_PREFERENCES,
} from '../../src/lib/community-preferences';
import { createReport } from '../../src/lib/api';

const pushMock = jest.fn();
const refreshMock = jest.fn();
const searchParamsMap = new Map<string, string>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParamsMap.get(key) ?? null,
  }),
}));

jest.mock('../../src/components/site-shell', () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../src/components/section-card', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: {
      id: 'reporter-user-1',
      email: 'reporter@example.com',
      displayName: '신고자',
      role: 'user',
    },
  }),
}));

jest.mock('../../src/lib/api', () => ({
  createReport: jest.fn(),
  getLogoutUrl: () => '/api/auth/logout',
}));

describe('SettingsPanel and NewReportPage (integration)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
    refreshMock.mockReset();
    searchParamsMap.clear();
    (createReport as jest.Mock).mockReset();
  });

  it('toggles settings, persists updated JSON to localStorage, and displays save confirmation', async () => {
    render(<SettingsPanel />);

    const pushCheckbox = screen.getByLabelText('푸시 알림 켜기') as HTMLInputElement;
    const communityModeCheckbox = screen.getByLabelText('커뮤니티 우선 모드') as HTMLInputElement;

    expect(pushCheckbox.checked).toBe(DEFAULT_COMMUNITY_PREFERENCES.pushNotifications);
    expect(communityModeCheckbox.checked).toBe(DEFAULT_COMMUNITY_PREFERENCES.communityOnlyMode);

    fireEvent.click(pushCheckbox);
    fireEvent.click(communityModeCheckbox);
    fireEvent.click(screen.getByRole('radio', { name: '친구에게만 공개' }));
    fireEvent.click(screen.getByRole('radio', { name: '익명 표시' }));

    expect(await screen.findByText('설정이 저장되었습니다.')).toBeInTheDocument();

    const raw = window.localStorage.getItem(COMMUNITY_PREFERENCES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      pushNotifications: false,
      communityOnlyMode: true,
      profileVisibility: 'friends',
      communityAuthorVisibility: 'anonymous',
    });
  });

  it('populates NewReportPage form from query params and calls createReport on submit', async () => {
    searchParamsMap.set('targetType', 'community-post');
    searchParamsMap.set('targetId', 'post-42');
    searchParamsMap.set('reason', '도배');
    searchParamsMap.set('details', '상세 사유');
    searchParamsMap.set('severity', 'high');
    searchParamsMap.set('source', '커뮤니티 글 #42');

    (createReport as jest.Mock).mockResolvedValue({ id: 'report-1' });

    render(<NewReportPage />);

    expect(screen.getByText('신고 대상: 커뮤니티 글 #42')).toBeInTheDocument();
    expect(screen.getByLabelText('대상 타입')).toHaveValue('community-post');
    expect(screen.getByLabelText('대상 ID')).toHaveValue('post-42');
    expect(screen.getByLabelText('사유')).toHaveValue('도배');
    expect(screen.getByLabelText('상세 사유')).toHaveValue('상세 사유');
    expect(screen.getByLabelText('심각도')).toHaveValue('high');

    fireEvent.click(screen.getByRole('button', { name: '신고 접수' }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith({
        targetType: 'community-post',
        targetId: 'post-42',
        reason: '도배',
        details: '상세 사유',
        severity: 'high',
        userId: 'reporter-user-1',
      });
    });
  });
});
