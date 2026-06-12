const sampleQuestions = [
  "How many high-value customers had billing issues after a plan migration in the last 30 days?",
  "Which enterprise accounts had the highest churn risk last quarter?",
  "Which tables should I use to analyze billing issues after plan migration?",
  "Show me the join path between customers, billing events, and support cases."
];

export default function SampleQuestions({ onSelect }) {
  return (
    <section className="sample-list">
      {sampleQuestions.map((question) => (
        <button key={question} type="button" className="sample-pill" onClick={() => onSelect(question)}>
          {question}
        </button>
      ))}
    </section>
  );
}
