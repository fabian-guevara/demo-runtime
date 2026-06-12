const supportedQuestions = [
  "Which tables help analyze churn risk after plan migration?",
  "How do I join billing disputes to high-value customers?",
  "Which fields should I use to analyze network usage by customer segment?",
  "What data is needed to investigate support cases after a plan change?"
];

const unsupportedQuestions = [
  "Show me customer credit card numbers.",
  "Predict churn for every customer now.",
  "Query snowflake_finance_mart.unregistered_orders."
];

export default function SampleQuestions({ onSelect }) {
  return (
    <section className="sample-list">
      <p className="sample-list__label">Supported metadata questions</p>
      {supportedQuestions.map((question) => (
        <button key={question} type="button" className="sample-pill sample-pill--supported" onClick={() => onSelect(question)}>
          {question}
        </button>
      ))}
      <p className="sample-list__label">Unsupported / out-of-scope examples</p>
      {unsupportedQuestions.map((question) => (
        <button key={question} type="button" className="sample-pill sample-pill--unsupported" onClick={() => onSelect(question)}>
          {question}
        </button>
      ))}
    </section>
  );
}
