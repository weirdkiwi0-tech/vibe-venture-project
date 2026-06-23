'use client';

import { useEffect, useState } from 'react';
import { getCommunityProfile, requestFriend } from '../lib/api';
import type { CommunityProfileDetailResponse } from '../lib/types';

interface CommunityProfileModalProps {
  userId: string;
  viewerId?: string;
  displayName: string;
  avatar: string;
  photoUrl?: string;
  compact?: boolean;
}

function AvatarImage({ photoUrl, displayName, avatar }: { photoUrl?: string; displayName: string; avatar: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={`${displayName} 프로필 사진`} className="community-person-avatar-image" />;
  }

  return <span className="community-person-avatar-fallback">{avatar}</span>;
}

export function CommunityProfileModal({ userId, viewerId, displayName, avatar, photoUrl, compact = false }: CommunityProfileModalProps) {
  const effectiveViewerId = viewerId ?? 'guest-user';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CommunityProfileDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getCommunityProfile(userId, effectiveViewerId);
        if (!mounted) return;
        setDetail(result);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : '프로필을 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [open, userId, effectiveViewerId]);

  const resolvedProfile = detail?.profile;
  const relationship = resolvedProfile?.relationship ?? 'none';
  const canRequestFriend = Boolean(effectiveViewerId && effectiveViewerId !== 'guest-user' && effectiveViewerId !== userId && relationship !== 'friend' && relationship !== 'pending-outgoing');

  return (
    <>
      <button
        type="button"
        className={`community-profile-chip ${compact ? 'compact' : ''}`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <span className="community-profile-chip-avatar">
          <AvatarImage photoUrl={resolvedProfile?.photoUrl ?? photoUrl} displayName={resolvedProfile?.name ?? displayName} avatar={resolvedProfile?.avatar ?? avatar} />
        </span>
        <span className="community-profile-chip-name">{resolvedProfile?.name ?? displayName}</span>
      </button>

      {open ? (
        <div className="community-profile-overlay" role="presentation" onClick={() => setOpen(false)}>
          <section className="community-profile-modal surface-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            {loading ? <div className="empty-state">프로필을 불러오는 중입니다...</div> : null}
            {error ? <p className="form-message error">{error}</p> : null}
            {resolvedProfile ? (
              <>
                <div className="profile-identity-card" style={{ marginBottom: '1rem' }}>
                  <span className="community-profile-modal-avatar">
                    <AvatarImage photoUrl={resolvedProfile.photoUrl} displayName={resolvedProfile.name} avatar={resolvedProfile.avatar} />
                  </span>
                  <div className="profile-identity-info">
                    <h3>{resolvedProfile.name}</h3>
                    <p className="card-meta">{resolvedProfile.school} · {resolvedProfile.grade}</p>
                    <p className="card-meta">{resolvedProfile.bio}</p>
                  </div>
                </div>

                <div className="community-profile-modal-action-row">
                  {relationship === 'friend' ? (
                    <span className="status-chip">친구</span>
                  ) : relationship === 'pending-outgoing' ? (
                    <span className="status-chip">요청 보냄</span>
                  ) : relationship === 'self' ? (
                    <span className="status-chip">내 계정</span>
                  ) : canRequestFriend ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={requesting}
                      onClick={async () => {
                        if (!viewerId) return;
                        setRequesting(true);
                        try {
                          await requestFriend({ targetId: userId, userId: effectiveViewerId });
                          const refreshed = await getCommunityProfile(userId, effectiveViewerId);
                          setDetail(refreshed);
                        } finally {
                          setRequesting(false);
                        }
                      }}
                    >
                      {requesting ? '전송 중...' : '친구추가하기'}
                    </button>
                  ) : null}
                </div>

                {resolvedProfile.lastMessagePreview ? (
                  <p className="card-meta">최근 대화: {resolvedProfile.lastMessagePreview}</p>
                ) : null}
              </>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
