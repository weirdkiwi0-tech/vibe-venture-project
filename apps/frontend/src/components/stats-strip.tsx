export function StatsStrip({ items }: { items: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <div className="stats-strip">
      {items.map((item) => (
        <div key={item.label} className="stat-card">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </div>
      ))}
    </div>
  );
}