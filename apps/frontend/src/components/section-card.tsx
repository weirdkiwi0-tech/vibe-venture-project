import type { ReactNode } from 'react';

export function SectionCard({
  eyebrow,
  title,
  children,
  className = '',
  action,
  id,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`section-card ${className}`.trim()}>
      <div className="section-header">
        <div className="section-header-main">
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action ? <div className="section-header-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}