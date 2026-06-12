const scenarios = [
  "Show churn risk for Texas enterprise accounts",
  "Now compare that to last month",
  "What evidence supports that?",
  "Find the latest account with a billing dispute",
  "Remember leadership cares most about billing disputes, NPS drops, and network incidents",
  "Start a new conversation",
  "Analyze Texas enterprise churn risk again"
];

export default function DemoScenarioButtons({ onSelect }) {
  return (
    <section className="scenario-bar">
      {scenarios.map((scenario) => (
        <button key={scenario} type="button" className="scenario-pill" onClick={() => onSelect(scenario)}>
          {scenario}
        </button>
      ))}
    </section>
  );
}
