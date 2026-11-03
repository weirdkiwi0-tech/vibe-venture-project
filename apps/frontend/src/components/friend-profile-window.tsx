'use client';

import type { CommunityProfileDetailResponse } from '../lib/types';
import { PublicProfileActivity } from './public-profile-activity';

interface FriendProfileWindowProps {
  open: boolean;
  profile: CommunityProfileDetailResponse | null;
  viewerId: string;
  onClose: () => void;
  onStartChat: () => void;
}

function AvatarImage({ photoUrl, displayName, avatar }: { photoUrl?: string; displayName: string; avatar: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={`${displayName} 프로필 사진`} className="community-person-avatar-image" />;
  }

  return <span className="community-person-avatar-fallback">{avatar}</span>;
}

export function FriendProfileWindow({ open, profile, viewerId, onClose, onStartChat }: FriendProfileWindowProps) {
  if (!open || !profile) {
    return null;
  }

  const { profile: friendProfile, messages, canChat } = profile;

  return (
    <div className="community-profile-overlay fullscreen" role="presentation" onClick={onClose}>
      <section className="community-profile-window surface-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="community-profile-window-header">
          <div className="profile-identity-card profile-identity-card-large">
            <span className="community-profile-modal-avatar">
              <AvatarImage
                photoUrl={friendProfile.photoUrl}
                displayName={friendProfile.name}
                avatar={friendProfile.avatar}
              />
            </span>
            <div className="profile-identity-info">
              <div className="profile-window-kicker">친구 프로필</div>
              <h2>{friendProfile.name}</h2>
              <p className="card-meta">{friendProfile.name} 님의 프로필입니다.</p>
            </div>
          </div>
          <div className="community-profile-window-actions">
            {canChat ? (
              <button type="button" className="primary-button" onClick={onStartChat}>
                1대1채팅하기
              </button>
            ) : (
              <span className="status-chip">채팅 불가</span>
            )}
            <button type="button" className="secondary-button" onClick={onClose}>
              닫기
            </button>
          </div>
        </header>

        <div className="community-profile-window-body">
          <section className="community-profile-window-panel">
            <PublicProfileActivity
              key={`${friendProfile.id}:${viewerId}`}
              profileId={friendProfile.id}
              viewerId={viewerId}
            />
          </section>

          <section className="community-profile-window-panel">
            <div className="card-meta">최근 대화</div>
            {messages.length > 0 ? (
              <div className="stack-list community-dm-thread-preview">
                {messages.map((message) => (
                  <div key={message.id} className={`community-dm-bubble ${message.senderId === friendProfile.id ? 'incoming' : 'outgoing'}`}>
                    <div className="community-dm-bubble-meta">
                      {message.senderId === friendProfile.id ? friendProfile.name : '나'}
                    </div>
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card-meta">아직 대화 기록이 없습니다.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
