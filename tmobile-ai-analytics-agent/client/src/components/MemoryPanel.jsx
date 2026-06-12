export default function MemoryPanel({
  conversationId,
  shortTermMemory,
  longTermMemories,
  onStorePreference,
  onClearMemories,
  onRefreshMemories
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Memory</p>
          <h2>Short-term and long-term memory</h2>
        </div>
        <div className="panel__actions">
          <button type="button" onClick={onStorePreference}>
            Store demo preference
          </button>
          <button type="button" onClick={onRefreshMemories}>
            Refresh
          </button>
          <button type="button" onClick={onClearMemories}>
            Clear demo memories
          </button>
        </div>
      </div>

      <div className="memory-grid">
        <div className="memory-card">
          <span>Conversation ID</span>
          <strong>{conversationId || "New conversation pending"}</strong>
        </div>
        <div className="memory-card">
          <span>Short-term context</span>
          <strong>
            {shortTermMemory?.resolvedContext
              ? `${shortTermMemory.resolvedContext.region} ${shortTermMemory.resolvedContext.segment}`
              : "No follow-up resolution used yet"}
          </strong>
        </div>
      </div>

      <div className="context-list">
        {longTermMemories.length === 0 ? <p className="panel__empty">No long-term memories stored yet.</p> : null}
        {longTermMemories.map((memory, index) => (
          <article key={`${memory.key ?? "memory"}-${index}`} className="context-card">
            <div className="context-card__meta">
              <span>{memory.key ?? "memory"}</span>
              <span>{memory.metadata?.memoryType ?? "preference"}</span>
            </div>
            <p>{memory.memoryText ?? memory.value?.content ?? "No text"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
