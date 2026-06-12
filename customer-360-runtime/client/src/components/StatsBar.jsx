export default function StatsBar({ stats }) {
  const segments = stats?.segments ?? [];

  return (
    <section className="stats-bar">
      <article className="stats-bar__card">
        <p className="stats-bar__label">Customers in Atlas</p>
        <strong>{Number(stats?.totalCustomers ?? 0).toLocaleString()}</strong>
      </article>
      <article className="stats-bar__card">
        <p className="stats-bar__label">High churn risk (active)</p>
        <strong>{Number(stats?.highChurnRiskActive ?? 0).toLocaleString()}</strong>
      </article>
      {segments.slice(0, 2).map((segment) => (
        <article key={segment._id} className="stats-bar__card">
          <p className="stats-bar__label">{segment._id}</p>
          <strong>{Number(segment.count ?? 0).toLocaleString()}</strong>
        </article>
      ))}
    </section>
  );
}
