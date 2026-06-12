export default function Layout({ main, sidebar, sidebarCollapsed = false }) {
  return (
    <div className={`app-shell${sidebarCollapsed ? " app-shell--terminal-collapsed" : ""}`}>
      <main className="app-shell__main">{main}</main>
      <aside className="app-shell__sidebar">{sidebar}</aside>
    </div>
  );
}
