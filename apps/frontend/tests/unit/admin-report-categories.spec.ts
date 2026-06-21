import {
  REPORT_CATEGORY_LABELS,
  belongsToReportCategory,
  getReportCategory,
  getReportTypeLabel,
} from '../../src/lib/admin-report-categories';

describe('admin report categories (unit)', () => {
  it('maps all target types to the expected category', () => {
    expect(getReportCategory('community-post')).toBe('community');
    expect(getReportCategory('question')).toBe('question');
    expect(getReportCategory('answer')).toBe('question');
    expect(getReportCategory('video')).toBe('video');
    expect(getReportCategory('comment')).toBe('comment');
  });

  it('filters membership by category', () => {
    expect(belongsToReportCategory('community-post', 'community')).toBe(true);
    expect(belongsToReportCategory('question', 'question')).toBe(true);
    expect(belongsToReportCategory('answer', 'question')).toBe(true);
    expect(belongsToReportCategory('video', 'video')).toBe(true);
    expect(belongsToReportCategory('comment', 'comment')).toBe(true);
    expect(belongsToReportCategory('video', 'question')).toBe(false);
  });

  it('returns labels for tabs and report rows', () => {
    expect(REPORT_CATEGORY_LABELS.community).toBe('커뮤니티 게시글');
    expect(REPORT_CATEGORY_LABELS.question).toBe('문제 질문작성');
    expect(REPORT_CATEGORY_LABELS.video).toBe('문제 풀이 영상');
    expect(REPORT_CATEGORY_LABELS.comment).toBe('댓글');

    expect(getReportTypeLabel('question')).toBe('질문 신고');
    expect(getReportTypeLabel('answer')).toBe('답변 신고');
    expect(getReportTypeLabel('video')).toBe('영상 신고');
    expect(getReportTypeLabel('comment')).toBe('댓글/답글 신고');
    expect(getReportTypeLabel('community-post')).toBe('커뮤니티 게시글 신고');
  });
});