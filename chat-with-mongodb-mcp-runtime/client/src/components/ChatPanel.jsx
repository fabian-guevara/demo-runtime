import { useEffect, useRef } from "react";
import { markdownToHtml } from "../utils/markdown.js";

export default function ChatPanel({ messages, question, onQuestionChange, onSend, loading, samplePrompts }) {
  const chatLogRef = useRef(null);

  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (!chatLog) {
      return;
    }

    chatLog.scrollTo({
      top: chatLog.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, loading]);

  return (
    <section className="panel panel--chat">
      <div className="panel__heading">
        <div>
          <p className="panel__eyebrow">MCP + LLM</p>
          <h2>Network ops chat</h2>
        </div>
      </div>

      <div className="sample-row">
        {samplePrompts.map((prompt) => (
          <button key={prompt} type="button" className="button button--ghost" onClick={() => onSend(prompt)}>
            Run sample incident flow
          </button>
        ))}
      </div>

      <div className="chat-log" ref={chatLogRef}>
        {messages.map((message) => (
          <article key={message.id} className={`chat-bubble chat-bubble--${message.role}`}>
            <span>{message.role === "user" ? "You" : "Agent"}</span>
            {message.role === "assistant" ? (
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(message.text) }}
              />
            ) : (
              <p>{message.text}</p>
            )}
            {message.llmModel ? <small>LLM: {message.llmModel}</small> : null}
          </article>
        ))}
      </div>

      <textarea
        value={question}
        onChange={(event) => onQuestionChange(event.target.value)}
        placeholder="Ask about recent tower alerts, impacted sites, or remediation steps..."
      />
      <button type="button" className="button button--primary" disabled={loading} onClick={() => onSend(question)}>
        {loading ? "Running MCP tools..." : "Send"}
      </button>
    </section>
  );
}
