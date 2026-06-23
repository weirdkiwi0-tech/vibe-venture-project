'use client';

import { useEffect, useState } from 'react';
import { getLogoutUrl } from '../lib/api';
import {
  COMMUNITY_PREFERENCES_STORAGE_KEY,
  DEFAULT_COMMUNITY_PREFERENCES,
  normalizeCommunityPreferences,
  type CommunityPreferences,
} from '../lib/community-preferences';
import { useAuthUser } from './role-provider';

type SaveState = 'idle' | 'saving' | 'saved';

type AppSettings = CommunityPreferences;

export function SettingsPanel() {
  const { authResolved, authUser } = useAuthUser();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_COMMUNITY_PREFERENCES);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    const raw = window.localStorage.getItem(COMMUNITY_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      setSettings(normalizeCommunityPreferences(JSON.parse(raw)));
    } catch {
      setSettings(DEFAULT_COMMUNITY_PREFERENCES);
    }
  }, []);

  async function save(nextSettings: AppSettings) {
    setSaveState('saving');
    window.localStorage.setItem(COMMUNITY_PREFERENCES_STORAGE_KEY, JSON.stringify(nextSettings));
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 1200);
  }

  return (
    <div className="stack-list">
      <article className="surface-card">
        <div className="card-meta">알림</div>
        <h3>푸시 알림</h3>
        <p>질문 답변, 신고 처리 결과 같은 중요한 이벤트를 푸시 알림으로 받습니다.</p>
        <label>
          <input
            type="checkbox"
            checked={settings.pushNotifications}
            onChange={async (event) => {
              const nextSettings = {
                ...settings,
                pushNotifications: event.target.checked,
              };
              setSettings(nextSettings);
              await save(nextSettings);
            }}
          />
          푸시 알림 켜기
        </label>
      </article>

      <article className="surface-card">
        <div className="card-meta">피드</div>
        <h3>커뮤니티 중심 모드</h3>
        <p>커뮤니티 피드를 우선으로 탐색하도록 기본 진입 흐름을 맞춥니다.</p>
        <label>
          <input
            type="checkbox"
            checked={settings.communityOnlyMode}
            onChange={async (event) => {
              const nextSettings = {
                ...settings,
                communityOnlyMode: event.target.checked,
              };
              setSettings(nextSettings);
              await save(nextSettings);
            }}
          />
          커뮤니티 우선 모드
        </label>
      </article>

      <article className="surface-card">
        <div className="card-meta">공개 범위</div>
        <h3>프로필 공개 범위</h3>
        <p>프로필 공개 범위를 전체 사용자 또는 친구로 제한할 수 있습니다.</p>
        <div className="visibility-toggle" role="radiogroup" aria-label="프로필 공개 범위">
          <button
            type="button"
            role="radio"
            aria-checked={settings.profileVisibility === 'public'}
            className={`visibility-option ${settings.profileVisibility === 'public' ? 'active' : ''}`}
            onClick={async () => {
              if (settings.profileVisibility === 'public') {
                return;
              }

              const nextSettings = {
                ...settings,
                profileVisibility: 'public' as const,
              };
              setSettings(nextSettings);
              await save(nextSettings);
            }}
          >
            전체 공개
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.profileVisibility === 'friends'}
            className={`visibility-option ${settings.profileVisibility === 'friends' ? 'active' : ''}`}
            onClick={async () => {
              if (settings.profileVisibility === 'friends') {
                return;
              }

              const nextSettings = {
                ...settings,
                profileVisibility: 'friends' as const,
              };
              setSettings(nextSettings);
              await save(nextSettings);
            }}
          >
            친구에게만 공개
          </button>
        </div>
      </article>

      <article className="surface-card">
        <div className="card-meta">커뮤니티 표시</div>
        <h3>댓글과 대댓글 표시 방식</h3>
        <p>커뮤니티 게시글, 댓글, 대댓글은 기본적으로 닉네임으로 보이고, 원하면 익명으로 바꿀 수 있습니다.</p>
        <div className="visibility-toggle" role="radiogroup" aria-label="커뮤니티 표시 방식">
          <button
            type="button"
            role="radio"
            aria-checked={settings.communityAuthorVisibility === 'nickname'}
            className={`visibility-option ${settings.communityAuthorVisibility === 'nickname' ? 'active' : ''}`}
            onClick={async () => {
              if (settings.communityAuthorVisibility === 'nickname') {
                return;
              }

              const nextSettings = {
                ...settings,
                communityAuthorVisibility: 'nickname' as const,
              };
              setSettings(nextSettings);
              await save(nextSettings);
            }}
          >
            닉네임 표시
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={settings.communityAuthorVisibility === 'anonymous'}
            className={`visibility-option ${settings.communityAuthorVisibility === 'anonymous' ? 'active' : ''}`}
            onClick={async () => {
              if (settings.communityAuthorVisibility === 'anonymous') {
                return;
              }

              const nextSettings = {
                ...settings,
                communityAuthorVisibility: 'anonymous' as const,
              };
              setSettings(nextSettings);
              await save(nextSettings);
            }}
          >
            익명 표시
          </button>
        </div>
      </article>

      {authResolved && authUser ? (
        <article className="surface-card">
          <div className="card-meta">계정</div>
          <h3>로그아웃</h3>
          <p>현재 로그인한 계정에서 안전하게 로그아웃합니다.</p>
          <div className="hero-actions">
            <a className="secondary-button" href={getLogoutUrl()}>
              로그아웃
            </a>
          </div>
        </article>
      ) : null}

      {saveState !== 'idle' ? (
        <p className="form-message success">{saveState === 'saving' ? '설정을 저장하는 중입니다.' : '설정이 저장되었습니다.'}</p>
      ) : null}
    </div>
  );
}
