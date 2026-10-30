import {
  DEFAULT_COMMUNITY_PREFERENCES,
  normalizeCommunityPreferences,
} from '../../src/lib/community-preferences';
import { createReportLink } from '../../src/lib/report-links';

describe('community-preferences and report-links utilities (unit)', () => {
  describe('normalizeCommunityPreferences', () => {
    it('returns defaults for null, undefined, or primitive values', () => {
      expect(normalizeCommunityPreferences(null)).toEqual(DEFAULT_COMMUNITY_PREFERENCES);
      expect(normalizeCommunityPreferences(undefined)).toEqual(DEFAULT_COMMUNITY_PREFERENCES);
      expect(normalizeCommunityPreferences('invalid')).toEqual(DEFAULT_COMMUNITY_PREFERENCES);
    });

    it('falls back to default booleans when pushNotifications or communityOnlyMode are non-boolean values', () => {
      const normalized = normalizeCommunityPreferences({
        pushNotifications: 'no',
        communityOnlyMode: 1,
      } as unknown);

      expect(normalized.pushNotifications).toBe(DEFAULT_COMMUNITY_PREFERENCES.pushNotifications);
      expect(normalized.communityOnlyMode).toBe(DEFAULT_COMMUNITY_PREFERENCES.communityOnlyMode);
    });

    it('preserves valid boolean and enum values', () => {
      const normalized = normalizeCommunityPreferences({
        pushNotifications: false,
        communityOnlyMode: true,
        profileVisibility: 'friends',
        communityAuthorVisibility: 'anonymous',
      });

      expect(normalized).toEqual({
        pushNotifications: false,
        communityOnlyMode: true,
        profileVisibility: 'friends',
        communityAuthorVisibility: 'anonymous',
      });
    });
  });

  describe('createReportLink', () => {
    it('builds /reports/new URL with trimmed targetId, sourceLabel, reason, and details', () => {
      const href = createReportLink({
        targetType: 'community-post',
        targetId: '  post-101  ',
        sourceLabel: '  커뮤니티 글 #101  ',
        reason: '  불쾌한 표현  ',
        details: '  상세 신고 내용입니다.  ',
        severity: 'high',
      });

      const [pathname, queryString] = href.split('?');
      const params = new URLSearchParams(queryString);

      expect(pathname).toBe('/reports/new');
      expect(params.get('targetType')).toBe('community-post');
      expect(params.get('targetId')).toBe('post-101');
      expect(params.get('source')).toBe('커뮤니티 글 #101');
      expect(params.get('reason')).toBe('불쾌한 표현');
      expect(params.get('details')).toBe('상세 신고 내용입니다.');
      expect(params.get('severity')).toBe('high');
    });

    it('omits details query param when details is whitespace-only', () => {
      const href = createReportLink({
        targetType: 'comment',
        targetId: 'comment-9',
        sourceLabel: '댓글 #9',
        reason: '광고/홍보',
        details: '   ',
      });

      const [, queryString] = href.split('?');
      const params = new URLSearchParams(queryString);

      expect(params.has('details')).toBe(false);
    });
  });
});
