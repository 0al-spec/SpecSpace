import styles from "./ViewerPage.module.css";

export function ViewerHero() {
  return (
    <>
      <p className={styles.eyebrow}>
        <span aria-hidden className={styles.eyebrowLine} />
        <span aria-hidden className={styles.eyebrowDot} />
        GraphSpace · Day 14
      </p>

      <h1 className={styles.title}>
        A new viewer for{" "}
        <em className={styles.titleEmphasis}>SpecGraph artifacts</em>
      </h1>

      <p className={styles.intro}>
        Live artifact diagnostics now distinguish real empty artifacts
        from sample fallback. Empty Implementation Work means the
        producer emitted a valid zero-item handoff, not that the panel is
        disconnected.
      </p>
    </>
  );
}
