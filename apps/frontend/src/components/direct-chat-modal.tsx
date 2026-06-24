'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCommunityProfile, sendDirectMessage } from '../lib/api';
import type { CommunityProfileDetailResponse } from '../lib/types';

interface DirectChatTarget {
  id: string;
  name: string;
  avatar: string;
  photoUrl?: string;
}

interface DirectChatModalProps {
  open: boolean;
  viewerId: string;
  target: DirectChatTarget | null;
  onClose: () => void;
}

function AvatarImage({ photoUrl, displayName, avatar }: { photoUrl?: string; displayName: string; avatar: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={`${displayName} 프로필 사진`} className="community-person-avatar-image" />;
  }

  return <span className="community-person-avatar-fallback">{avatar}</span>;
}

export function DirectChatModal({ open, viewerId, target, onClose }: DirectChatModalProps) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<CommunityProfileDetailResponse | null>(null);
  const [content, setContent] = useState('');

  const canChat = detail?.canChat ?? false;
  const messages = detail?.messages ?? [];
  const profile = detail?.profile;

  const resolvedName = useMemo(() => profile?.name ?? target?.name ?? '친구', [profile?.name, target?.name]);

  useEffect(() => {
    if (!open || !target) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getCommunityProfile(target.id, viewerId);
        if (!mounted) {
          return;
        }
        setDetail(result);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : '채팅 정보를 불러오지 못했습니다.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [open, target, viewerId]);

  if (!open || !target) {
    return null;
  }

  return (
    <div className="community-profile-overlay fullscreen" role="presentation" onClick={onClose}>
      <section className="community-chat-window surface-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="community-chat-header">
          <div className="community-chat-header-title">
            <span className="community-profile-modal-avatar community-chat-avatar">
              <AvatarImage
                photoUrl={profile?.photoUrl ?? target.photoUrl}
                displayName={resolvedName}
                avatar={profile?.avatar ?? target.avatar}
              />
            </span>
            <div>
              <div className="profile-window-kicker">1:1 채팅</div>
              <h2>{resolvedName}</h2>
              <p className="card-meta">메시지는 본인과 친구만 볼 수 있어요.</p>
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            닫기
          </button>
        </header>

        {loading ? <p className="card-meta">채팅 정보를 불러오는 중입니다…</p> : null}
        {error ? <p className="form-message error">{error}</p> : null}

        {!loading && !error ? (
          canChat ? (
            <>
              <div className="community-chat-thread" aria-label="채팅 내용">
                {messages.length > 0 ? (
                  messages.map((msg) => {
                    const mine = msg.senderId === viewerId;
                    return (
                      <div key={msg.id} className={`community-chat-row ${mine ? 'mine' : 'theirs'}`}>
                        {!mine ? (
                          <span className="community-chat-peer-avatar">
                            {profile?.avatar ?? target.avatar}
                          </span>
                        ) : null}
                        <div className={`community-dm-bubble ${mine ? 'outgoing' : 'incoming'}`}>
                          <div className="community-dm-bubble-meta">{mine ? '나' : resolvedName}</div>
                          <p>{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">아직 대화 기록이 없습니다.</div>
                )}
              </div>

              <form
                className="community-chat-composer"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const trimmed = content.trim();
                  if (!trimmed) {
                    return;
                  }
                  setSending(true);
                  setError('');
                  try {
                    await sendDirectMessage({ recipientId: target.id, content: trimmed, userId: viewerId });
                    setContent('');
                    const refreshed = await getCommunityProfile(target.id, viewerId);
                    setDetail(refreshed);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '메시지 전송에 실패했습니다.');
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <label className="community-chat-input-wrap">
                  <span className="sr-only">메시지</span>
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    name="dmContent"
                    rows={1}
                    required
                    placeholder="메시지를 입력하세요."
                    className="community-chat-input"
                  />
                </label>
                <button type="submit" className="primary-button" disabled={sending || !content.trim()}>
                  {sending ? '전송 중...' : '전송'}
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state">친구가 아니면 1:1 채팅을 시작할 수 없습니다.</div>
          )
        ) : null}
      </section>
    </div>
  );
}
