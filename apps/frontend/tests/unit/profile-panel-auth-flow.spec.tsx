import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfilePanel } from '../../src/components/profile-panel';

const signInLocalMock = jest.fn();
const signUpLocalMock = jest.fn();
const refetchAuthMock = jest.fn<Promise<boolean>, []>();

jest.mock('../../src/components/role-provider', () => ({
  useAuthUser: () => ({
    authResolved: true,
    authUser: null,
    refetchAuth: refetchAuthMock,
  }),
}));

jest.mock('../../src/lib/api', () => ({
  deleteAnswer: jest.fn(),
  deleteCommunityPost: jest.fn(),
  deleteQuestion: jest.fn(),
  deleteVideo: jest.fn(),
  getCommunityBoard: jest.fn(),
  getCommunityProfile: jest.fn(),
  getGoogleAuthUrl: jest.fn(() => '#'),
  getMyAnswers: jest.fn(),
  getMyCommunityPosts: jest.fn(),
  getMyQuestions: jest.fn(),
  getMyVideos: jest.fn(),
  acceptFriendRequest: jest.fn(),
  requestFriend: jest.fn(),
  sendDirectMessage: jest.fn(),
  signInLocal: (...args: unknown[]) => signInLocalMock(...args),
  signUpLocal: (...args: unknown[]) => signUpLocalMock(...args),
}));

describe('ProfilePanel auth submit flow (unit)', () => {
  beforeEach(() => {
    signInLocalMock.mockReset();
    signUpLocalMock.mockReset();
    refetchAuthMock.mockReset();
  });

  it('로그인 시 이메일을 trim/lowercase 정규화해서 전송한다', async () => {
    const user = userEvent.setup();
    signInLocalMock.mockResolvedValue({ success: true });
    refetchAuthMock.mockResolvedValue(true);

    render(<ProfilePanel />);

    await user.type(screen.getByRole('textbox', { name: '이메일' }), '  Student@Example.COM  ');
    await user.type(screen.getByLabelText('비밀번호'), 'Secure@99');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(signInLocalMock).toHaveBeenCalledWith({
      email: 'student@example.com',
      password: 'Secure@99',
    });
  });

  it('세션 확인 실패 시 폼을 초기화하지 않고 재시도 안내를 보여준다', async () => {
    const user = userEvent.setup();
    signInLocalMock.mockResolvedValue({ success: true });
    refetchAuthMock.mockResolvedValue(false);

    render(<ProfilePanel />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' }) as HTMLInputElement;
    const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement;

    await user.type(emailInput, 'student@example.com');
    await user.type(passwordInput, 'Secure@99');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(refetchAuthMock).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('로그인 세션 확인이 지연되고 있습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();
    expect(emailInput.value).toBe('student@example.com');
    expect(passwordInput.value).toBe('Secure@99');
  });

  it('세션 확인 성공 시 폼을 초기화한다', async () => {
    const user = userEvent.setup();
    signInLocalMock.mockResolvedValue({ success: true });
    refetchAuthMock.mockResolvedValue(true);

    render(<ProfilePanel />);

    const emailInput = screen.getByRole('textbox', { name: '이메일' }) as HTMLInputElement;
    const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement;

    await user.type(emailInput, 'student@example.com');
    await user.type(passwordInput, 'Secure@99');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');
  });
});
