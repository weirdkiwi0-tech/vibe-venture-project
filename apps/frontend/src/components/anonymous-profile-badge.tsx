interface AnonymousProfileBadgeProps {
  compact?: boolean;
  ariaLabel?: string;
}

export function AnonymousProfileBadge({ compact = false, ariaLabel = '익명 작성자' }: AnonymousProfileBadgeProps) {
  return (
    <span className={`community-profile-chip ${compact ? 'compact' : ''}`} aria-label={ariaLabel}>
      <span className="community-profile-chip-avatar">
        <span className="community-person-avatar-fallback">익</span>
      </span>
      <span className="community-profile-chip-name">익명</span>
    </span>
  );
}
