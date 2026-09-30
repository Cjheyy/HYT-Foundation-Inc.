export function Skeleton({ width = '100%', height = 16, radius = 8, style = {} }) {
  return (
    <div
      aria-hidden="true"
      className="hyt-skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, #eef2f7 25%, #e2e8f0 37%, #eef2f7 63%)',
        backgroundSize: '400% 100%',
        animation: 'hyt-skeleton-shimmer 1.2s ease-in-out infinite',
        ...style
      }}
    />
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="metric-card" aria-hidden="true">
      <Skeleton width={56} height={56} radius={14} style={{ marginBottom: 16 }} />
      <Skeleton width="40%" height={32} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="90%" height={12} />
    </div>
  );
}

export function ListItemSkeleton({ rows = 3 }) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #eef2f7',
            borderRadius: 12,
            padding: 16,
            background: '#fff'
          }}
        >
          <Skeleton width="45%" height={16} style={{ marginBottom: 10 }} />
          <Skeleton width="90%" height={12} style={{ marginBottom: 6 }} />
          <Skeleton width="60%" height={12} />
        </div>
      ))}
    </div>
  );
}
