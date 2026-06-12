function formatDate(value) {
  if (!value) {
    return "n/a";
  }

  return new Date(value).toLocaleDateString();
}

export default function CustomerProfilePanel({ profile, loading }) {
  if (loading) {
    return (
      <section className="customer-profile">
        <p className="customer-profile__empty">Loading customer 360 profile...</p>
      </section>
    );
  }

  if (!profile?.customer) {
    return (
      <section className="customer-profile">
        <p className="customer-profile__empty">
          Select a customer to view plan, device, churn risk, and recent interactions from MongoDB.
        </p>
      </section>
    );
  }

  const { customer, interactions = [] } = profile;

  return (
    <section className="customer-profile">
      <header className="customer-profile__header">
        <div>
          <p className="customer-profile__eyebrow">Customer 360</p>
          <h2>
            {customer.firstName} {customer.lastName}
          </h2>
          <p className="customer-profile__subline">
            {customer.customerId} · {customer.msisdn} · {customer.email}
          </p>
        </div>
        <span className={`customer-profile__status customer-profile__status--${customer.status}`}>
          {customer.status}
        </span>
      </header>

      <div className="customer-profile__grid">
        <article>
          <span>Segment</span>
          <strong>{customer.segment}</strong>
        </article>
        <article>
          <span>Plan</span>
          <strong>{customer.plan}</strong>
        </article>
        <article>
          <span>Market</span>
          <strong>{customer.market}</strong>
        </article>
        <article>
          <span>Churn risk</span>
          <strong>{Math.round((customer.churnRisk ?? 0) * 100)}%</strong>
        </article>
        <article>
          <span>LTV</span>
          <strong>${Number(customer.ltv ?? 0).toLocaleString()}</strong>
        </article>
        <article>
          <span>Lines</span>
          <strong>{customer.lines ?? 1}</strong>
        </article>
        <article>
          <span>Device</span>
          <strong>{customer.deviceModel ?? "Unknown"}</strong>
        </article>
        <article>
          <span>Joined</span>
          <strong>{formatDate(customer.joinDate)}</strong>
        </article>
      </div>

      {customer.tags?.length ? (
        <div className="customer-profile__tags">
          {customer.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className="customer-profile__interactions">
        <h3>Recent interactions</h3>
        {interactions.length === 0 ? (
          <p className="customer-profile__empty">No recent interactions stored for this customer.</p>
        ) : (
          <ul>
            {interactions.map((interaction) => (
              <li key={interaction.interactionId}>
                <div>
                  <strong>{interaction.topic.replaceAll("_", " ")}</strong>
                  <span>{interaction.channel.replaceAll("_", " ")}</span>
                </div>
                <p>{interaction.summary}</p>
                <small>
                  {formatDate(interaction.occurredAt)} · {interaction.sentiment} ·{" "}
                  {interaction.resolved ? "resolved" : "open"}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
