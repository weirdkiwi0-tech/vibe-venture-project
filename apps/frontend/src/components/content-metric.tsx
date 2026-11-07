'use client';

import Link from 'next/link';
import type { Route } from 'next';

const SYMBOLS = {
  like: '\u2661',
  view: '\u{1F441}\uFE0E',
  answer: '\u{1F5E8}\uFE0E',
  comment: '\u{1F5E8}\uFE0E',
  report: '\u2691',
};

type SymbolKind = keyof typeof SYMBOLS;
type MetricKind = Exclude<SymbolKind, 'report'>;

const LABELS: Record<MetricKind, string> = {
  like: '좋아요',
  view: '조회',
  answer: '답변',
  comment: '댓글',
};

export function ContentSymbol({ kind, active = false }: { kind: SymbolKind; active?: boolean }) {
  return (
    <span className="content-symbol" aria-hidden="true">
      {kind === 'like' && active ? '\u2665' : SYMBOLS[kind]}
    </span>
  );
}

export function ContentMetric<T extends string = string>({
  kind, count, active = false, href,
}: {
  kind: MetricKind;
  count: number;
  active?: boolean;
  href?: Route<T>;
}) {
  const label = `${LABELS[kind]} ${count}${kind === 'view' ? '회' : '개'}`;
  const metric = (
    <span className="content-metric" aria-label={label} title={href ? `${LABELS[kind]} 보기` : LABELS[kind]}>
      <ContentSymbol kind={kind} active={active} />
      <span>{count}</span>
    </span>
  );

  return href ? (
    <Link
      href={href}
      className="content-metric-link"
      aria-label={`${label} 보기`}
      title={`${LABELS[kind]} 보기`}
      onClick={(event) => event.stopPropagation()}
    >
      {metric}
    </Link>
  ) : metric;
}
