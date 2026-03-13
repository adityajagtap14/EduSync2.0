'use client';

export default function KpiCard({ title, value, badge, badgeType = 'neutral', style }) {
  return (
    <div className="kpi-card" style={style}>
      <h4>{title}</h4>
      <h2>{value}</h2>
      {badge && (
        <span className={`badge badge-${badgeType}`} style={{ marginTop: '5px' }}>
          {badge}
        </span>
      )}
    </div>
  );
}
