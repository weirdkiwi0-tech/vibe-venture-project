'use client';

import { useEffect, useState } from 'react';
import { getLogoutUrl } from '../lib/api';
import { useAuthUser } from './role-provider';

type SaveState = 'idle' | 'saving' | 'saved';

interface AppSettings {
  pushNotifications: boolean;
  communityOnlyMode: boolean;
  profileVisibility: 'public' | 'friends';
}

const STORAGE_KEY = 'keepit-settings-v1';

const DEFAULT_SETTINGS: AppSettings = {
  pushNotifications: true,
  communityOnlyMode: false,
  profileVisibility: 'public',
};

export function SettingsPanel() {
  const { authResolved, authUser } = useAuthUser();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      setSettings({
        pushNotifications: parsed.pushNotifications ?? DEFAULT_SETTINGS.pushNotifications,
        communityOnlyMode: parsed.communityOnlyMode ?? DEFAULT_SETTINGS.communityOnlyMode,
        profileVisibility: parsed.profileVisibility === 'friends' ? 'friends' : 'public',
      });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  }, []);

  async function save(nextSettings: AppSettings) {
    setSaveState('saving');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
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
