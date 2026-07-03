import { Panel } from "@/shared/ui/panel";
import { PanelBtn } from "@/shared/ui/panel-btn";
import styles from "./UiCatalogPage.module.css";

const utilityPanelComponentItems = [
  "Report status row",
  "Rail width preview",
  "Fullscreen overlay preview",
] as const;

const catalogSections = [
  {
    id: "utility-panel-components",
    title: "Utility panel components",
    status: "active",
    href: "/dev/idea-to-spec-fixtures",
    items: utilityPanelComponentItems,
  },
  {
    id: "shared-primitives",
    title: "Shared primitives",
    status: "seed",
    href: "#shared-primitives",
    items: ["Panel", "PanelBtn", "Overlay anchor"],
  },
] as const;

export function UiCatalogPage() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div>
          <span className={styles.kicker}>SpecSpace UI catalog</span>
          <h1 className={styles.title}>Design system workbench</h1>
          <p className={styles.subtitle}>
            Dev-only catalog for isolating UI primitives and domain composites
            before they are promoted into production surfaces.
          </p>
        </div>
        <dl className={styles.summary} aria-label="Catalog summary">
          <div className={styles.summaryItem}>
            <dt>Scope</dt>
            <dd>dev route</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Fixtures</dt>
            <dd>read-only</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>Layers</dt>
            <dd>pages / shared</dd>
          </div>
        </dl>
      </header>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="UI catalog sections">
          <span className={styles.navLabel}>Catalog sections</span>
          <div className={styles.navList}>
            {catalogSections.map((section) => (
              <a className={styles.navLink} href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className={styles.content}>
          <section className={styles.section} id="utility-panel-components">
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Domain composites</span>
                <h2 className={styles.sectionTitle}>Utility panel components</h2>
              </div>
              <a className={styles.sectionAction} href="/dev/idea-to-spec-fixtures">
                Open fixture gallery
              </a>
            </div>
            <div className={styles.cardGrid}>
              {utilityPanelComponentItems.map((item) => (
                <a
                  className={styles.catalogCard}
                  href={`/dev/idea-to-spec-fixtures#${fixtureAnchor(item)}`}
                  key={item}
                >
                  <span className={styles.cardTitle}>{item}</span>
                  <span className={styles.cardMeta}>Team Decision fixture</span>
                </a>
              ))}
            </div>
          </section>

          <section className={styles.section} id="shared-primitives">
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionKicker}>Shared UI</span>
                <h2 className={styles.sectionTitle}>Shared primitives</h2>
              </div>
              <span className={styles.badge}>seed</span>
            </div>
            <div className={styles.primitiveGrid}>
              <Panel tone="strong" padding="sm" className={styles.primitivePanel}>
                <span className={styles.cardTitle}>Panel</span>
                <span className={styles.cardMeta}>strong / sm</span>
              </Panel>
              <Panel tone="default" padding="sm" className={styles.primitivePanel}>
                <span className={styles.cardTitle}>Panel</span>
                <span className={styles.cardMeta}>default / sm</span>
              </Panel>
              <div
                className={styles.buttonSet}
                role="group"
                aria-label="Panel button examples"
              >
                <PanelBtn title="Default panel button" aria-label="Default panel button">
                  +
                </PanelBtn>
                <PanelBtn
                  active
                  title="Active panel button"
                  aria-label="Active panel button"
                >
                  *
                </PanelBtn>
                <PanelBtn
                  badge={3}
                  title="Panel button with badge"
                  aria-label="Panel button with badge"
                >
                  i
                </PanelBtn>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function fixtureAnchor(label: string): string {
  switch (label) {
    case "Report status row":
      return "report-status-row";
    case "Rail width preview":
      return "team-decision-rail";
    case "Fullscreen overlay preview":
      return "team-decision-overlay";
    default:
      return "utility-panel-components";
  }
}
