import { fireEvent, render, screen } from '@testing-library/react';
import { ContentMetric, ContentSymbol } from '../../src/components/content-metric';
import { SectionCard } from '../../src/components/section-card';

describe('monochrome content metrics', () => {
  it.each([0, 3])('links a speech bubble with %i answers directly to the discussion', (count) => {
    const parentClick = jest.fn();
    render(
      <div onClick={parentClick}>
        <ContentMetric kind="answer" count={count} href="/questions/q-1#answers" />
      </div>,
    );
    const link = screen.getByRole('link', { name: `답변 ${count}개 보기` });
    expect(link).toHaveAttribute('href', '/questions/q-1#answers');
    expect(link).toHaveAttribute('title', '답변 보기');
    expect(link).toHaveTextContent('\u{1F5E8}\uFE0E');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    click.preventDefault();
    fireEvent(link, click);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('places the anchor on the discussion section itself', () => {
    render(<SectionCard id="answers" eyebrow="이전 답변" title="등록된 답변 목록">No answers yet</SectionCard>);
    expect(screen.getByRole('heading', { name: '등록된 답변 목록' }).closest('section')).toHaveAttribute('id', 'answers');
  });

  it.each([
    ['like', '좋아요 12개', '\u2661'],
    ['view', '조회 12회', '\u{1F441}\uFE0E'],
    ['answer', '답변 12개', '\u{1F5E8}\uFE0E'],
    ['comment', '댓글 12개', '\u{1F5E8}\uFE0E'],
  ] as const)('renders %s with a text glyph, count and accessible label', (kind, label, symbol) => {
    const { container } = render(<ContentMetric kind={kind} count={12} />);
    expect(screen.getByLabelText(label)).toHaveTextContent(`${symbol}12`);
    const icon = container.querySelector('.content-symbol');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.textContent).toBe(symbol);
    expect(container.textContent).not.toContain('\uFE0F');
  });

  it('switches heart shape when liked and preserves zero counts', () => {
    const { rerender } = render(<ContentMetric kind="like" count={0} />);
    expect(screen.getByLabelText('좋아요 0개')).toHaveTextContent('\u26610');
    rerender(<ContentMetric kind="like" count={1} active />);
    expect(screen.getByLabelText('좋아요 1개')).toHaveTextContent('\u26651');
    rerender(<ContentMetric kind="like" count={0} />);
    expect(screen.getByLabelText('좋아요 0개')).toHaveTextContent('\u26610');
  });

  it('uses a text flag rather than an emoji flag', () => {
    const { container } = render(<ContentSymbol kind="report" />);
    expect(container.querySelector('.content-symbol')?.textContent).toBe('\u2691');
  });
});
