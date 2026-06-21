import {
  REPORT_CATEGORY_LABELS,
  belongsToReportCategory,
  getReportCategory,
  type AdminReportCategory,
} from '../../src/admin/report-category.util';

describe('admin report category util (unit)', () => {
  it('maps target types to 4 report categories', () => {
    expect(getReportCategory('community-post')).toBe('community');
    expect(getReportCategory('question')).toBe('question');
    expect(getReportCategory('answer')).toBe('question');
    expect(getReportCategory('video')).toBe('video');
    expect(getReportCategory('comment')).toBe('comment');
  });

  it('checks category membership', () => {
    const categories: AdminReportCategory[] = ['community', 'question', 'video', 'comment'];
    for (const category of categories) {
      expect(belongsToReportCategory('community-post', category)).toBe(category === 'community');
      expect(belongsToReportCategory('question', category)).toBe(category === 'question');
      expect(belongsToReportCategory('answer', category)).toBe(category === 'question');
      expect(belongsToReportCategory('video', category)).toBe(category === 'video');
      expect(belongsToReportCategory('comment', category)).toBe(category === 'comment');
    }
  });

  it('provides fixed labels for report tabs', () => {
    expect(REPORT_CATEGORY_LABELS.community).toBe('커뮤니티 게시글');
    expect(REPORT_CATEGORY_LABELS.question).toBe('문제 질문작성');
    expect(REPORT_CATEGORY_LABELS.video).toBe('문제 풀이 영상');
    expect(REPORT_CATEGORY_LABELS.comment).toBe('댓글');
  });
});