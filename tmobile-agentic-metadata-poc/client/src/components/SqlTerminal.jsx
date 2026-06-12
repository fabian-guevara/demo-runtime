export default function SqlTerminal({ sql }) {
  return (
    <section className="panel panel--terminal">
      <div className="panel__heading">
        <div>
          <p className="panel__eyebrow">Generated SQL</p>
          <h2>Warehouse query draft</h2>
        </div>
      </div>
      <pre className="terminal-block">{sql}</pre>
    </section>
  );
}
