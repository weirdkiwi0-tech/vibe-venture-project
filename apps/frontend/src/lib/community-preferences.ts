import { useEffect, useState } from 'react';

export type CommunityAuthorVisibility = 'nickname' | 'anonymous';

export interface CommunityPreferences {
  pushNotifications: boolean;
  communityOnlyMode: boolean;
  profileVisibility: 'public' | 'friends';
  communityAuthorVisibility: CommunityAuthorVisibility;
}

export const COMMUNITY_PREFERENCES_STORAGE_KEY = 'keepit-settings-v1';

export const DEFAULT_COMMUNITY_PREFERENCES: CommunityPreferences = {
  pushNotifications: true,
  communityOnlyMode: false,
  profileVisibility: 'public',
  communityAuthorVisibility: 'nickname',
};

export function normalizeCommunityPreferences(value: unknown): CommunityPreferences {
  const parsed = typeof value === 'object' && value !== null ? (value as Partial<CommunityPreferences>) : {};
  return {
    pushNotifications:
      typeof parsed.pushNotifications === 'boolean'
        ? parsed.pushNotifications
        : DEFAULT_COMMUNITY_PREFERENCES.pushNotifications,
    communityOnlyMode:
      typeof parsed.communityOnlyMode === 'boolean'
        ? parsed.communityOnlyMode
        : DEFAULT_COMMUNITY_PREFERENCES.communityOnlyMode,
    profileVisibility: parsed.profileVisibility === 'friends' ? 'friends' : 'public',
    communityAuthorVisibility: parsed.communityAuthorVisibility === 'anonymous' ? 'anonymous' : 'nickname',
  };
}

export function useCommunityPreferences() {
  const [preferences, setPreferences] = useState<CommunityPreferences>(DEFAULT_COMMUNITY_PREFERENCES);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COMMUNITY_PREFERENCES_STORAGE_KEY);
      if (!raw) {
        return;
      }

      setPreferences(normalizeCommunityPreferences(JSON.parse(raw)));
    } catch {
      setPreferences(DEFAULT_COMMUNITY_PREFERENCES);
    }
  }, []);

  const updatePreferences = (nextPreferences: CommunityPreferences) => {
    setPreferences(nextPreferences);
    window.localStorage.setItem(COMMUNITY_PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
  };

  return { preferences, setPreferences: updatePreferences };
}
