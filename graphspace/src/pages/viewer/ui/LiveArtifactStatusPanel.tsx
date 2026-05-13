import type { ArtifactDiagnostic } from "../model/live-artifacts";
import styles from "./LiveArtifactStatusPanel.module.css";

type Props = {
  diagnostics: readonly ArtifactDiagnostic[];
  runsWatchVersion: number;
  showHeader?: boolean;
};

export function LiveArtifactStatusPanel({
  diagnostics,
  runsWatchVersion,
  showHeader = true,
}: Props) {
  return (
    <section className={styles.panel} aria-label="Live artifact status">
      {showHeader ? (
        <header className={styles.header}>
          <span className={styles.title}>Live artifacts</span>
          <span className={styles.meta}>runs tick {runsWatchVersion}</span>
        </header>
      ) : null}
      <div className={styles.list}>
        {diagnostics.map((artifact) => (
          <div
            key={artifact.id}
            className={[styles.row, styles[`tone-${artifact.tone}`]].join(" ")}
          >
            <div className={styles.name}>
              <span className={styles.label}>{artifact.label}</span>
              <span className={styles.endpoint}>{artifact.endpoint}</span>
              <span className={styles.detail}>{artifact.detail}</span>
            </div>
            <div className={styles.status}>
              <span className={styles.pill}>{artifact.status}</span>
              <span className={styles.count}>{artifact.countLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
