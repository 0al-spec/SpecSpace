import styles from "./OntologyViewerPage.module.css";

const AUTHORITY_ROWS = [
  ["Ontology writes", "disabled"],
  ["Spec mutations", "disabled"],
  ["Registry publish", "disabled"],
  ["Source", "local browser state"],
] as const;

export function OntologyViewerPage() {
  return (
    <main className={styles.root} aria-label="Ontology viewer">
      <header className={styles.header}>
        <div className={styles.brand}>
          <h1 className={styles.title}>Ontology</h1>
          <span className={styles.kicker}>local artifact viewer</span>
        </div>
        <a className={styles.link} href="/">
          SpecGraph
        </a>
      </header>

      <div className={styles.content}>
        <section className={styles.surface} aria-label="Ontology graph canvas">
          <div className={styles.surfaceHeader}>
            <span className={styles.panelKicker}>Graph</span>
            <span className={`${styles.statusValue} ${styles.statusValueMuted}`}>
              no artifact loaded
            </span>
          </div>
          <div className={styles.surfaceBody}>
            <div className={styles.mark} aria-hidden="true">
              O
            </div>
          </div>
        </section>

        <aside className={styles.panel} aria-label="Ontology authority boundary">
          <span className={styles.panelKicker}>Authority boundary</span>
          <div className={styles.statusCard}>
            {AUTHORITY_ROWS.map(([label, value]) => (
              <div className={styles.statusRow} key={label}>
                <span className={styles.statusLabel}>{label}</span>
                <span className={styles.statusValue}>{value}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
