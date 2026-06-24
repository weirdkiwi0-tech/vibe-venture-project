'use client';

import { useEffect, useId, useState } from 'react';
import {
  acceptFriendRequest,
  deleteAnswer,
  deleteCommunityPost,
  deleteQuestion,
  deleteVideo,
  getCommunityBoard,
  getCommunityProfile,
  getGoogleAuthUrl,
  getMyAnswers,
  getMyCommunityPosts,
  getMyQuestions,
  getMyVideos,
  signInLocal,
  signUpLocal,
} from '../lib/api';
import { useAuthUser } from './role-provider';
import type {
  CommunityProfileDetailResponse,
  CommunityProfileSummary,
  MyAnswerItem,
  MyCommunityPostItem,
  MyVideoItem,
  QuestionItem,
} from '../lib/types';
import { DirectChatModal } from './direct-chat-modal';

type ProfileTab = 'activity' | 'friends';
type ActivitySubTab = 'questions' | 'comments' | 'videos' | 'posts';

const DEFAULT_PROFILE_IMAGE = '/default-profile.svg';

function toProfileSummary(friend: { id: string; name: string; avatar: string }): CommunityProfileSummary {
  return {
    id: friend.id,
    name: friend.name,
    role: 'student',
    school: '',
    grade: '',
    bio: '',
    avatar: friend.avatar,
    subjects: [],
    relationship: 'friend',
    friendCount: 0,
    lastMessagePreview: '',
  };
}

function toProfileSummaries(friends: Array<{ id: string; name: string; avatar: string }>): CommunityProfileSummary[] {
  return friends.map(toProfileSummary);
}

export function ProfilePanel() {
  const { authResolved, authUser, refetchAuth } = useAuthUser();
  const profilePhotoInputId = useId();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photoFileName, setPhotoFileName] = useState('선택된 파일 없음');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    photoUrl: '',
  });

  // 탭 상태
  const [activeTab, setActiveTab] = useState<ProfileTab>('activity');
  const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>('videos');

  // 내 활동
  const [myQuestions, setMyQuestions] = useState<QuestionItem[]>([]);
  const [myAnswers, setMyAnswers] = useState<MyAnswerItem[]>([]);
  const [myVideos, setMyVideos] = useState<MyVideoItem[]>([]);
  const [myPosts, setMyPosts] = useState<MyCommunityPostItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  // 내 친구
  const [friends, setFriends] = useState<CommunityProfileSummary[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<CommunityProfileSummary[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<CommunityProfileSummary[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [selectedFriendProfile, setSelectedFriendProfile] = useState<CommunityProfileDetailResponse | null>(null);
  const [friendDetailLoading, setFriendDetailLoading] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ id: string; name: string; avatar: string; photoUrl?: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const resetSignedOutState = () => {
    setMyQuestions([]);
    setMyAnswers([]);
    setMyVideos([]);
    setMyPosts([]);
    setActivityError('');
    setFriends([]);
    setPendingIncoming([]);
    setPendingOutgoing([]);
    setFriendsError('');
    setSelectedFriendProfile(null);
  };

  useEffect(() => {
    if (!authUser) {
      resetSignedOutState();
      return;
    }

    let mounted = true;

    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError('');
      try {
        const [questions, answers, videos, posts] = await Promise.all([
          getMyQuestions(authUser.id),
          getMyAnswers(authUser.id),
          getMyVideos(authUser.id),
          getMyCommunityPosts(authUser.id),
        ]);
        if (!mounted) return;
        setMyQuestions(questions);
        setMyAnswers(answers);
        setMyVideos(videos);
        setMyPosts(posts);
      } catch (err) {
        if (!mounted) return;
        setActivityError(err instanceof Error ? err.message : '내 활동 기록을 불러오지 못했습니다.');
      } finally {
        if (mounted) setActivityLoading(false);
      }
    };

    const loadFriends = async () => {
      setFriendsLoading(true);
      setFriendsError('');
      try {
        const board = await getCommunityBoard(authUser.id);
        const friendDetails = await Promise.all(
          board.friends.map(async (friend) => {
            try {
              return await getCommunityProfile(friend.id, authUser.id);
            } catch {
              return null;
            }
          }),
        );
        if (!mounted) return;
        setFriends(toProfileSummaries(board.friends));
        setPendingIncoming(
          friendDetails
            .filter((detail): detail is CommunityProfileDetailResponse => Boolean(detail?.incomingFriendRequestId))
            .map((detail) => detail.profile),
        );
        setPendingOutgoing([]);
      } catch (err) {
        if (!mounted) return;
        setFriendsError(err instanceof Error ? err.message : '친구 목록을 불러오지 못했습니다.');
      } finally {
        if (mounted) setFriendsLoading(false);
      }
    };

    void loadActivity();
    void loadFriends();

    return () => { mounted = false; };
  }, [authUser]);

  if (!authResolved) {
    return <div className="empty-state">프로필 정보를 불러오는 중입니다.</div>;
  }

  if (!authUser) {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        if (isSignUp) {
          if (!formData.displayName) {
            setError('닉네임을 입력해주세요.');
            setLoading(false);
            return;
          }
          await signUpLocal(formData);
        } else {
          await signInLocal({ email: formData.email, password: formData.password });
        }
        await refetchAuth();
        setFormData({ email: '', password: '', displayName: '', photoUrl: '' });
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="surface-card">
        <div className="card-meta">로그인 / 회원가입</div>
        <h3>{isSignUp ? '계정 생성' : '로그인'}</h3>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            이메일
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              placeholder="example@test.com"
              disabled={loading}
            />
          </label>
          {isSignUp && (
            <label>
              닉네임
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="닉네임"
                disabled={loading}
              />
            </label>
          )}
          {isSignUp && (
            <label>
              프로필 사진
              <input
                id={profilePhotoInputId}
                className="file-input-hidden"
                type="file"
                accept="image/*"
                disabled={loading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setPhotoFileName('선택된 파일 없음');
                    setFormData({ ...formData, photoUrl: '' });
                    return;
                  }

                  setPhotoFileName(file.name);
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = typeof reader.result === 'string' ? reader.result : '';
                    setFormData((prev) => ({ ...prev, photoUrl: result }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div className="file-picker-row">
                <label htmlFor={profilePhotoInputId} className="file-picker-button" aria-disabled={loading}>
                  사진 선택
                </label>
                <span className="file-picker-name">{photoFileName}</span>
              </div>
              <small>선택하지 않으면 기본 프로필 이미지가 적용됩니다.</small>
              <div style={{ marginTop: '0.5rem' }}>
                <img
                  src={formData.photoUrl || DEFAULT_PROFILE_IMAGE}
                  alt="프로필 미리보기"
                  width={64}
                  height={64}
                  style={{ borderRadius: '50%', objectFit: 'cover' }}
                />
              </div>
            </label>
          )}
          <label>
            비밀번호
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="••••••"
              disabled={loading}
            />
          </label>
          {error && <p style={{ color: '#dc3545' }}>{error}</p>}
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? (isSignUp ? '생성 중...' : '로그인 중...') : isSignUp ? '계정 생성' : '로그인'}
          </button>
          {!isSignUp ? (
            <a className="secondary-button" href={getGoogleAuthUrl()}>
              구글로 로그인
            </a>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setPhotoFileName('선택된 파일 없음');
              setFormData({ email: '', password: '', displayName: '', photoUrl: '' });
            }}
            disabled={loading}
          >
            {isSignUp ? '로그인으로 돌아가기' : '계정 생성하기'}
          </button>
        </form>
      </div>
    );
  }

  const confirmDelete = () => window.confirm('삭제하시겠습니까?');

  const handleDeleteQuestion = async (id: string) => {
    if (!confirmDelete()) return;
    try {
      await deleteQuestion(id, authUser.id);
      setMyQuestions((prev) => prev.filter((item) => item.id !== id));
      setMyAnswers((prev) => prev.filter((item) => item.questionId !== id));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : '질문 삭제에 실패했습니다.');
    }
  };

  const handleDeleteAnswer = async (id: string) => {
    if (!confirmDelete()) return;
    try {
      await deleteAnswer(id, authUser.id);
      setMyAnswers((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.');
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirmDelete()) return;
    try {
      await deleteVideo(id, authUser.id);
      setMyVideos((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : '영상 삭제에 실패했습니다.');
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirmDelete()) return;
    try {
      await deleteCommunityPost(id, authUser.id);
      setMyPosts((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : '게시글 삭제에 실패했습니다.');
    }
  };

  const handleOpenFriendProfile = async (profileId: string) => {
    setFriendDetailLoading(true);
    setSelectedFriendProfile(null);
    try {
      const detail = await getCommunityProfile(profileId, authUser.id);
      setSelectedFriendProfile(detail);
    } finally {
      setFriendDetailLoading(false);
    }
  };

  const refreshFriends = async () => {
    const board = await getCommunityBoard(authUser.id);
    const friendDetails = await Promise.all(
      board.friends.map(async (friend) => {
        try {
          return await getCommunityProfile(friend.id, authUser.id);
        } catch {
          return null;
        }
      }),
    );

    setFriends(toProfileSummaries(board.friends));
    setPendingIncoming(
      friendDetails
        .filter((detail): detail is CommunityProfileDetailResponse => Boolean(detail?.incomingFriendRequestId))
        .map((detail) => detail.profile),
    );
    setPendingOutgoing([]);
  };

  const textAnswers = myAnswers.filter((item) => item.type === 'text');

  const activitySubTabs: Array<{ key: ActivitySubTab; label: string; count: number }> = [
    { key: 'videos', label: '풀이 영상', count: myVideos.length },
    { key: 'questions', label: '질문 작성', count: myQuestions.length },
    { key: 'posts', label: '커뮤니티', count: myPosts.length },
    { key: 'comments', label: '댓글', count: textAnswers.length },
  ];

  return (
    <div className="stack-list">
      {/* ─── 사용자 기본 정보 카드 ─── */}
      <article className="surface-card profile-identity-card">
        <img
          src={authUser.photoUrl || DEFAULT_PROFILE_IMAGE}
          alt={`${authUser.displayName} 프로필 사진`}
          className="profile-identity-avatar"
        />
        <div className="profile-identity-info">
          <h3>{authUser.displayName}</h3>
          <p className="card-meta">{authUser.email}</p>
          <div className="profile-identity-chips">
            <span className="status-chip">{authUser.role === 'admin' ? '관리자' : '학생'}</span>
          </div>
        </div>
      </article>

      {/* ─── 메인 탭 ─── */}
      <div className="profile-tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'activity'}
          className={`profile-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <span className="profile-tab-icon">📋</span>
          <span>내 활동</span>
          <small>
            {myQuestions.length + textAnswers.length + myVideos.length + myPosts.length}건
          </small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'friends'}
          className={`profile-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          <span className="profile-tab-icon">🤝</span>
          <span>내 친구</span>
          <small>
            {friends.length}명
            {pendingIncoming.length > 0 ? ` · 요청 ${pendingIncoming.length}` : ''}
          </small>
        </button>
      </div>

      {/* ─── 내 활동 탭 패널 ─── */}
      {activeTab === 'activity' ? (
        <article className="surface-card">
          {activityLoading ? (
            <p className="card-meta">내 활동을 불러오는 중입니다…</p>
          ) : activityError ? (
            <p style={{ color: '#dc3545' }}>{activityError}</p>
          ) : (
            <>
              {/* 서브 탭 */}
              <div className="profile-subtab-bar" role="tablist">
                {activitySubTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activitySubTab === tab.key}
                    className={`profile-subtab ${activitySubTab === tab.key ? 'active' : ''}`}
                    onClick={() => setActivitySubTab(tab.key)}
                  >
                    {tab.label}
                    <span className="profile-subtab-count">{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* 풀이영상 */}
              {activitySubTab === 'videos' ? (
                <div className="stack-list profile-content-area">
                  {myVideos.length === 0 ? (
                    <div className="empty-state">등록한 풀이영상이 없습니다.</div>
                  ) : (
                    myVideos.map((item) => (
                      <div key={item.id} className="surface-card profile-activity-item">
                        <div className="profile-activity-topline">
                          <strong>{item.title}</strong>
                          <span className="community-badge subtle">{item.subject || '일반'}</span>
                        </div>
                        <p className="card-meta">조회 {item.viewCount} · 좋아요 {item.likeCount} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
                        <div className="hero-actions">
                          <a className="secondary-button" href={`/videos/${item.id}`}>보기</a>
                          <button type="button" className="secondary-button" onClick={() => void handleDeleteVideo(item.id)}>삭제</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {/* 질문 */}
              {activitySubTab === 'questions' ? (
                <div className="stack-list profile-content-area">
                  {myQuestions.length === 0 ? (
                    <div className="empty-state">작성한 질문이 없습니다.</div>
                  ) : (
                    myQuestions.map((item) => (
                      <div key={item.id} className="surface-card profile-activity-item">
                        <div className="profile-activity-topline">
                          <strong>{item.title}</strong>
                          <span className="community-badge subtle">{item.subject} · 고{item.grade}</span>
                        </div>
                        <p className="card-meta">좋아요 {item.likeCount} · 댓글 {item.answerCount} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
                        <div className="hero-actions">
                          <a className="secondary-button" href={`/questions/${item.id}`}>보기</a>
                          <button type="button" className="secondary-button" onClick={() => void handleDeleteQuestion(item.id)}>삭제</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {/* 댓글 */}
              {activitySubTab === 'comments' ? (
                <div className="stack-list profile-content-area">
                  {textAnswers.length === 0 ? (
                    <div className="empty-state">작성한 댓글이 없습니다.</div>
                  ) : (
                    textAnswers.map((item) => (
                      <div key={item.id} className="surface-card profile-activity-item">
                        <p>{item.content}</p>
                        <p className="card-meta">{new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
                        <div className="hero-actions">
                          <a className="secondary-button" href={`/questions/${item.questionId}`}>원문 보기</a>
                          <button type="button" className="secondary-button" onClick={() => void handleDeleteAnswer(item.id)}>삭제</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {/* 커뮤니티 게시글 */}
              {activitySubTab === 'posts' ? (
                <div className="stack-list profile-content-area">
                  {myPosts.length === 0 ? (
                    <div className="empty-state">작성한 커뮤니티 게시글이 없습니다.</div>
                  ) : (
                    myPosts.map((item) => (
                      <div key={item.id} className="surface-card profile-activity-item">
                        <div className="profile-activity-topline">
                          <a className="text-link" href={`/community/posts/${item.id}`}>
                            <strong>{item.title}</strong>
                          </a>
                        </div>
                        <p className="card-meta">조회 {item.viewCount} · 좋아요 {item.likeCount} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
                        <div className="hero-actions">
                          <button type="button" className="secondary-button" onClick={() => void handleDeletePost(item.id)}>삭제</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </>
          )}
        </article>
      ) : null}

      {/* ─── 내 친구 탭 패널 ─── */}
      {activeTab === 'friends' ? (
        <div className="stack-list">
          {friendsLoading ? (
            <p className="card-meta">친구 목록을 불러오는 중입니다…</p>
          ) : friendsError ? (
            <p style={{ color: '#dc3545' }}>{friendsError}</p>
          ) : (
            <>
              {/* 받은 친구 요청 */}
              {pendingIncoming.length > 0 ? (
                <article className="surface-card">
                  <div className="card-meta">받은 친구 요청</div>
                  <div className="stack-list profile-friends-list">
                    {pendingIncoming.map((profile) => (
                      <div key={profile.id} className="profile-friend-card incoming">
                        <button
                          type="button"
                          className="community-person-avatar"
                          onClick={() => void handleOpenFriendProfile(profile.id)}
                          title={`${profile.name} 프로필 보기`}
                        >
                          {profile.avatar}
                        </button>
                        <div className="profile-friend-info">
                          <strong>{profile.name}</strong>
                          <span className="card-meta">{profile.school} · {profile.grade}</span>
                          <span className="card-meta">{profile.subjects.join(', ') || '관심 과목 없음'}</span>
                        </div>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={async () => {
                            const profileDetail = await getCommunityProfile(profile.id, authUser.id);
                            if (!profileDetail.incomingFriendRequestId) return;
                            await acceptFriendRequest({ requestId: profileDetail.incomingFriendRequestId, userId: authUser.id });
                            await refreshFriends();
                            setSelectedFriendProfile(null);
                          }}
                        >
                          수락
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {/* 보낸 친구 요청 */}
              {pendingOutgoing.length > 0 ? (
                <article className="surface-card">
                  <div className="card-meta">보낸 친구 요청</div>
                  <div className="stack-list profile-friends-list">
                    {pendingOutgoing.map((profile) => (
                      <div key={profile.id} className="profile-friend-card">
                        <button
                          type="button"
                          className="community-person-avatar"
                          onClick={() => void handleOpenFriendProfile(profile.id)}
                          title={`${profile.name} 프로필 보기`}
                        >
                          {profile.avatar}
                        </button>
                        <div className="profile-friend-info">
                          <strong>{profile.name}</strong>
                          <span className="card-meta">{profile.school} · {profile.grade}</span>
                        </div>
                        <span className="status-chip">대기 중</span>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {/* 친구 목록 */}
              <article className="surface-card">
                <div className="card-meta">친구 {friends.length}명</div>
                {friends.length === 0 ? (
                  <div className="empty-state">아직 친구가 없습니다. 커뮤니티에서 친구 요청을 보내보세요.</div>
                ) : (
                  <div className="stack-list profile-friends-list">
                    {friends.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className={`profile-friend-card clickable ${selectedFriendProfile?.profile.id === profile.id ? 'active' : ''}`}
                        onClick={() => void handleOpenFriendProfile(profile.id)}
                      >
                        <div className="community-person-avatar">{profile.avatar}</div>
                        <div className="profile-friend-info">
                          <strong>{profile.name}</strong>
                          <span className="card-meta">{profile.school} · {profile.grade}</span>
                          <span className="card-meta">{profile.subjects.join(', ') || '관심 과목 없음'}</span>
                          {profile.lastMessagePreview ? (
                            <small className="profile-last-message">{profile.lastMessagePreview}</small>
                          ) : null}
                        </div>
                        <span className="status-chip">친구</span>
                      </button>
                    ))}
                  </div>
                )}
              </article>

              {friendDetailLoading ? <p className="card-meta">불러오는 중…</p> : null}
            </>
          )}
        </div>
      ) : null}

      {selectedFriendProfile ? (
        <div className="community-profile-overlay" role="presentation" onClick={() => setSelectedFriendProfile(null)}>
          <section className="community-profile-modal surface-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="profile-friend-detail-header">
              <div className="community-person-avatar" style={{ width: 56, height: 56 }}>
                {selectedFriendProfile.profile.avatar}
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{selectedFriendProfile.profile.name}</h3>
                <p className="card-meta">{selectedFriendProfile.profile.school} · {selectedFriendProfile.profile.grade}</p>
                <p className="card-meta">관심 과목: {selectedFriendProfile.profile.subjects.join(', ') || '없음'}</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                style={{ alignSelf: 'start' }}
                onClick={() => setSelectedFriendProfile(null)}
              >
                닫기
              </button>
            </div>
            <p>{selectedFriendProfile.profile.bio}</p>

            {selectedFriendProfile.recentPosts.length > 0 ? (
              <div className="profile-friend-section">
                <div className="card-meta">최근 게시글</div>
                <div className="stack-list">
                  {selectedFriendProfile.recentPosts.slice(0, 3).map((post) => (
                    <div key={post.id} className="community-recent-post-card">
                      <span className={`community-badge ${post.type === 'problem' ? 'problem' : 'chat'}`}>
                        {post.type === 'problem' ? '문제 공유' : '자유 채팅'}
                      </span>
                      <p>{post.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="community-profile-modal-action-row">
              {selectedFriendProfile.canChat ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setChatTarget({
                      id: selectedFriendProfile.profile.id,
                      name: selectedFriendProfile.profile.name,
                      avatar: selectedFriendProfile.profile.avatar,
                      photoUrl: selectedFriendProfile.profile.photoUrl,
                    });
                    setChatOpen(true);
                  }}
                >
                  1대1채팅하기
                </button>
              ) : (
                <span className="status-chip">채팅 불가</span>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <DirectChatModal
        open={chatOpen}
        viewerId={authUser.id}
        target={chatTarget}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
