import { useState } from "react";
import { markdownToHtml } from "../utils/markdown.js";

function ChatBubble({ message }) {
  return (
    <article className={`chat-bubble chat-bubble--${message.role}`}>
      <span className="chat-bubble__role">{message.role === "user" ? "User" : "Assistant"}</span>
      {message.role === "assistant" ? (
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(message.text) }}
        />
      ) : (
        <p>{message.text}</p>
      )}
      {message.meta?.toolCalls?.length ? (
        <div className="chat-meta">
          <strong>Tool calls:</strong> {message.meta.toolCalls.map((call) => call.name).join(", ")}
        </div>
      ) : null}
      {typeof message.meta?.retrievedContextCount === "number" ? (
        <div className="chat-meta">
          <strong>Retrieved context:</strong> {message.meta.retrievedContextCount} evidence item
          {message.meta.retrievedContextCount === 1 ? "" : "s"} loaded.
        </div>
      ) : null}
      {message.meta?.shortTermMemoryUsed ? (
        <div className="chat-meta">
          <strong>Short-term memory:</strong> resolved follow-up from prior conversation context.
        </div>
      ) : null}
    </article>
  );
}

export default function ChatPanel({ messages, onSend, loading }) {
  const [draft, setDraft] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    const message = draft.trim();
    setDraft("");
    await onSend(message);
  }

  return (
    <section className="panel panel--chat">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Conversation</p>
          <h2>Leadership chat</h2>
        </div>
      </div>

      <div className="chat-feed">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about churn risk, evidence, or memory preferences..."
        />
        <button type="submit" disabled={loading}>
          {loading ? "Working..." : "Send"}
        </button>
      </form>
    </section>
  );
}
