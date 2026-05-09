import { useState } from "react";
import { Panel } from "@/shared/ui/panel";
import { PanelBtn, PanelBtnRow } from "@/shared/ui/panel-btn";
import { Overlay } from "@/shared/ui/overlay";

/**
 * Day 1 sanity check: renders the three baseline shared/ui components
 * so we can eyeball tokens and visual continuity with the SpecPM landing.
 * Will be replaced by pages/viewer once entities/spec-graph lands.
 */
export function App() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [timelineOn, setTimelineOn] = useState(true);
  const [count] = useState(3);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Panel
        tone="strong"
        padding="lg"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          maxWidth: 560,
        }}
      >
        <p
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            margin: 0,
            fontFamily: "var(--gs-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0,
            textTransform: "uppercase",
            color: "var(--gs-muted)",
          }}
        >
          <span
            aria-hidden
            style={{ width: 26, height: 1, background: "currentColor" }}
          />
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--gs-accent)",
              boxShadow: "0 0 0 3px var(--gs-accent-soft)",
            }}
          />
          GraphSpace · Day 1 Scaffold
        </p>

        <h1
          style={{
            margin: "16px 0 0",
            fontSize: 50,
            lineHeight: 1,
          }}
        >
          A new viewer for{" "}
          <em style={{ color: "var(--gs-muted-2)", fontStyle: "italic" }}>
            SpecGraph artifacts
          </em>
        </h1>

        <p
          style={{
            margin: "20px 0 0",
            color: "var(--gs-muted)",
            fontSize: 16,
            lineHeight: 1.62,
          }}
        >
          Tokens, <code>Panel</code>, <code>PanelBtn</code>, <code>Overlay</code>{" "}
          ported to the SpecPM editorial style. The graph, recent-changes,
          timeline and exploration panels arrive as soon as the SpecGraph
          contract slice lands.
        </p>
      </Panel>

      <Overlay anchor="top-left" direction="row">
        <PanelBtnRow>
          <PanelBtn
            title="Toggle timeline"
            active={timelineOn}
            onClick={() => setTimelineOn((v) => !v)}
          >
            ⏱
          </PanelBtn>
          <PanelBtn
            title="Open filter"
            active={filterOpen}
            badge={count}
            onClick={() => setFilterOpen((v) => !v)}
          >
            ⚲
          </PanelBtn>
          <PanelBtn dim title="Disabled action">
            ✕
          </PanelBtn>
        </PanelBtnRow>
      </Overlay>

      <Overlay anchor="bottom-right">
        <Panel tone="muted" padding="sm">
          <span
            style={{
              fontFamily: "var(--gs-mono)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--gs-muted)",
              letterSpacing: 0,
            }}
          >
            v0.0.1 · timeline {timelineOn ? "ON" : "OFF"} · filter{" "}
            {filterOpen ? "OPEN" : "CLOSED"}
          </span>
        </Panel>
      </Overlay>
    </div>
  );
}
