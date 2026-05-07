# Specs Graph — Performance & Memory Improvements

Контекст: в Safari при отображении ~50 spec-nodes в режиме **Linear** с включёнными тогглами **Show Blocking** + **Show depends_on** панорамирование раздувает память до 5–6 GB (в Chrome — ~1 GB). Ранее при `minZoom=0.125` появлялись розовые области canvas и зависал MacBook до watchdog-перезагрузки.

**Установленная причина №1 (zoom):** Safari превышает лимит GPU-текстуры (~16384px / ~268M pixels) при CSS `transform: scale()` на множестве composite-layers от expanded-нод.

**Рабочая гипотеза №2 (Linear + Blocking + depends_on):** дефолтные bezier SVG `<path>` через широкий Linear-viewport + HTML-лейблы через `<EdgeLabelRenderer>` + `strokeDasharray` — комбинация, которую Safari растрирует на порядок дороже, чем Chrome/Skia.

---

## ✅ Done

- [x] **Clamp zoom range** — в [App.tsx:775-776](viewer/app/src/App.tsx:775) поднят `minZoom: 0.125 → 0.4`, добавлен `maxZoom: 2`. Отсекает "death zone", где Safari падает при экстремальном зум-ауте.

---

## High priority — SpecGraph retrospective refactor maintenance

- [x] **Regression guard для `graph_dashboard` retrospective surface** — закрепить тестами и JSON/schema-check, что `--build-graph-dashboard` выводит `retrospective_refactor_candidates`, counts для `refactor_queue`/`proposal_queue` и viewer-ready named filter.
  - **Контекст:** поддерживает closure pass task 17 из ветки `codex/retrospective-refactor-closure`, commit `fbef367`.
  - **Метрика:** targeted dashboard/retrospective tests покрывают presence + shape + fixture с непустым retrospective set; standalone `--build-graph-dashboard` проходит JSON validation.

- [x] **Proposal runtime registry ↔ proposal status consistency** — добавить validation/test, который связывает proposals `0008` и `0017` со статусом `Implemented` с их runtime/tests markers и запрещает новым `Implemented` proposals проходить без registry markers.
  - **Метрика:** проверка падает на missing marker, stale status или registry entry без существующего proposal.
  - **Регресс-контроль:** `pytest -q`, targeted retrospective/proposal tests, `ruff`, `ruff format --check`, `compileall`.

- [x] **Closure audit для переноса active task → archive** — формализовать проверку, что закрытая задача удалена из active `tasks.md`, присутствует в `tasks_archive.md`, содержит commit/proposal/runtime references и не оставляет dangling dashboard/proposal queue references.
  - **Метрика:** audit-команда или тест на fixture task 17 проходит и документирует expected state после closure pass.

---

## High priority — SpecGraph Metrics delivery/feedback viewer integration

- [x] **External Consumers section в `GraphDashboard` для Metrics delivery/feedback** — расширить контракт [GraphDashboard.tsx](viewer/app/src/GraphDashboard.tsx), чтобы `sections.external_consumers` показывал `metrics_delivery_status_counts`, `metrics_delivery_review_state_counts`, `metrics_feedback_status_counts`, `metrics_feedback_review_state_counts`, named-filter counts и backlog counters, а не только top-level headline cards.
  - **Контекст:** поддерживает SpecGraph tasks 89-90 из ветки `codex/metrics-delivery-feedback`, commit `ea2886f`, где `graph_dashboard.json` получил `metrics_delivery_ready`, `metrics_feedback_visible` и Metrics delivery/feedback counts.
  - **Метрика:** fixture `graph_dashboard.json` с `sections.external_consumers` рендерит отдельную секцию External Consumers; `metrics_delivery_ready` и `metrics_feedback_visible` видны как headline/filter counts; `npm run build` проходит без `any`-обходов для нового section shape.

- [x] **Metrics Source Promotion panel для `SIB_FULL`** — добавить в dashboard отдельную карточку/панель "Metrics Source Promotion" для `runs/metrics_source_promotion_index.json` и новых полей `sections.external_consumers.metrics_source_promotion_*`.
  - **Контекст:** `SIB_FULL` должен быть виден как `promotion_candidate`, но не становиться authoritative автоматически; показывать `promotion_status`, `review_state`, `authority_state`, `next_gap`, `guardrails.requires_human_review` и связь `legacy_metric_ids`.
  - **Метрика:** headline card `metrics_source_promotion_ready` и named filter `viewer_projection.named_filters.metrics_source_promotion_ready` отображаются; `ready_for_promotion_review`/`promotion_candidate` попадают в External Consumers counts; guardrails визуально показывают review-first/no-auto-authority boundary.

- [x] **Read-only drilldown endpoints для Metrics handoff/promotion artifacts** — добавить безопасную выдачу allowlisted SpecGraph `runs/metrics_delivery_workflow.json`, `runs/metrics_feedback_index.json` и `runs/metrics_source_promotion_index.json` через viewer API, чтобы из dashboard можно было открыть строки workflow/feedback/promotion без прямого доступа к файловой системе.
  - **Метрика:** server tests покрывают happy path, missing artifact, invalid JSON и path traversal; UI показывает delivery/feedback rows с `delivery_status`/`feedback_status`, review state, next gap, checkout diagnostics и source artifact timestamp.

- [x] **Canonical Metrics rendering без double-count `sib_proxy`** — обновить Metrics section, чтобы authoritative problem counters брались из `sections.metrics.below_threshold_authoritative_metric_ids`, а `sib_proxy` рендерился как legacy/compatibility alias под canonical `sib`, а не как отдельная проблемная метрика.
  - **Контекст:** `metric_signal_index.json` теперь различает `sib` с `threshold_authority_state: canonical_threshold_authority` и `sib_proxy` с `alias_of: sib`, `threshold_authority_state: alias_only`, `signal_emitted: false`, `migration_state: compatibility_alias`.
  - **Метрика:** список метрик сворачивает/задимляет `sib_proxy` под `sib`; `metrics_below_threshold` и warning tables не считают `sib + sib_proxy` дважды; fixture проверяет `legacy_metric_ids`, `alias_of`, `signal_emitted: false`.

- [x] **Contract regression fixture для downstream Metrics surfaces** — закрепить минимальный dashboard/artifact fixture, совместимый с SpecGraph `metrics_delivery_policy.json`, `metrics_feedback_policy.json`, source-promotion artifact и canonical/alias metric shape, чтобы ContextBuilder не ломался при появлении новых statuses или named filters.
  - **Метрика:** fixture включает `ready_for_delivery_review`, `blocked_by_repo_state`, `review_activity_observed`, `adoption_observed_locally`, `ready_for_promotion_review`, `promotion_candidate`, `threshold_driven`; тест проверяет tolerant rendering unknown statuses + сохранение нулевых counts, где они важны для фильтров.

---

## High priority — SpecGraph backlog projection viewer integration

- [x] **Backlog section в `GraphDashboard` для `graph_backlog_projection`** — расширить dashboard-контракт под `sections.backlog` и headline card `graph_backlog_open`, чтобы viewer показывал не только backlog counts, но и reviewable rows.
  - **Контекст:** поддерживает новый SpecGraph artifact `runs/graph_backlog_projection.json` и CLI `python3 tools/supervisor.py --build-graph-backlog-projection`.
  - **Метрика:** dashboard fixture с `sections.backlog` рендерит отдельную секцию Backlog; card `graph_backlog_open` видна в headline cards; backlog rows показывают `domain`, `subject_id`, `next_gap`, `priority`, `source_artifact`.

- [x] **Read-only drilldown endpoint для backlog projection artifact** — добавить безопасную выдачу allowlisted `runs/graph_backlog_projection.json` через viewer API, чтобы Dashboard мог открывать конкретные backlog rows и provenance без прямого доступа к файловой системе.
  - **Метрика:** server tests покрывают happy path, missing artifact, invalid JSON и path traversal; UI сортирует/группирует rows по `priority` и `domain`, сохраняя `source_artifact` для traceability.

- [x] **Contract regression fixture для backlog projection** — закрепить минимальный fixture для `graph_dashboard.json` + `graph_backlog_projection.json`, чтобы новые dashboard rows оставались tolerant к новым backlog domains и priorities.
  - **Метрика:** fixture содержит несколько rows с разными `domain`, `priority`, `next_gap` и `source_artifact`; тест проверяет graceful rendering unknown domain/priority и отсутствие падения при пустом backlog.

---

## High priority — Dashboard build trigger

- [x] **`POST /api/viewer-surfaces/build` + кнопка Rebuild в Dashboard** — добавить endpoint, который запускает `supervisor.py --build-viewer-surfaces` (строит `graph_dashboard.json` + `graph_backlog_projection.json`), и кнопку в шапке дашборда с индикатором прогресса и обновлением данных после завершения.
  - **Capability detection:** grep supervisor.py на `--build-viewer-surfaces` (как у exploration_preview_build).
  - **Метрика:** кнопка появляется только когда capability=true; после нажатия показывает spinner, после завершения перечитывает `/api/graph-dashboard` без ручного F5; server tests покрывают happy path, supervisor missing, nonzero exit.

---

## High priority — быстрые победы

- [x] **`onlyRenderVisibleElements={true}`** на `<ReactFlow>` в [App.tsx:764](viewer/app/src/App.tsx:764). Ноды/рёбра вне viewport не рендерятся.
  - **Метрика:** `performance.memory.usedJSHeapSize` (Chrome) / Safari Web Inspector → Timelines → Memory при панорамировании через 3-4 viewport-а. Ожидаемое снижение: **≥30%** пикового heap.
  - **Доп. метрика:** `document.querySelectorAll('.react-flow__node').length` до/после — в viewport должно остаться ≤ visible нод + небольшой buffer.

- [x] **CSS-класс `zoomed-out`** на контейнере при `zoom < 0.5`: убрать `box-shadow`, `filter`, `backdrop-filter`, `border-radius` у `.react-flow__node`. Форсируют отдельные GPU-текстуры в Safari.
  - **Метрика:** Safari Web Inspector → Timelines → Rendering → "Layer" count при `zoom=0.4`. Ожидание: снижение числа composite layers **≥50%**.
  - **Визуальная валидация:** розовые тайлы не появляются при панорамировании на `zoom=0.4`.

---

## High priority — Safari × Linear × Blocking × depends_on (новая находка)

Воспроизведение: Linear mode + Show Blocking ON + Show depends_on ON, 50 nodes. Панорамирование → heap 5–6 GB в Safari, 1 GB в Chrome.

### H1. Убрать `label` у edges в Linear mode
**Файл:** [useSpecGraphData.ts:382,403,422](viewer/app/src/useSpecGraphData.ts:382)

Цвет + толщина уже кодируют тип (blocking=красный жирный, depends_on=красный, relates_to=фиолетовый пунктир). Лейблы рендерятся через `<EdgeLabelRenderer>` — HTML-div поверх SVG, в Safari каждый становится отдельным composite layer.

- **Метрика:** число DOM-элементов `.react-flow__edge-textwrapper` при Linear + оба тоггла. Ожидание: **~50–80 → 0**.
- **Сильная метрика:** heap при панорамировании 10 сек Safari. Ожидание: **5–6 GB → ≤2 GB**.
- **Валидация UX:** пользователь всё ещё различает типы рёбер по стилю (спросить после A/B).

### ~~H2. `type: "straight"` вместо `"default"` для Linear mode~~ (отклонено: smoothstep читаемее, возвращён обратно)
**Файл:** [useSpecGraphData.ts:357,383,404,423](viewer/app/src/useSpecGraphData.ts:357)

В Linear ноды стоят на одной горизонтали — bezier-кривые избыточны. Прямые линии = короче SVG path string, быстрее Safari path rasterization.

- **Метрика:** FPS при панорамировании (Safari Web Inspector → Timelines → Frames). Ожидание: **≥45 FPS** стабильно (сейчас проседает под 20 FPS).
- **Доп. метрика:** длина `d` атрибута `<path>` суммарно по всем edges до/после (через `document.querySelectorAll('path.react-flow__edge-path').reduce((s,p)=>s+p.getAttribute('d').length,0)`). Ожидание: **≥40%** сокращения.

### ✅ H3. Убрать `strokeDasharray` у Linear backward edges
**Файл:** [useSpecGraphData.ts:120-124,113-117](viewer/app/src/useSpecGraphData.ts:120) — `LINEAR_BACKWARD_STYLE`, `TREE_CROSSLINK_STYLE`

Safari кэширует dasharray-паттерн отдельной текстурой на каждую уникальную комбинацию (pattern × color × width × scale). Заменить на solid line другого оттенка.

- **Метрика:** bisect — включить H1+H2, замерить heap; добавить H3, замерить ещё раз. Изолирует вклад dasharray.
- **Ожидание:** дополнительно **10–20%** heap.

### H4. `onlyRenderVisibleElements={true}` (дубль из "быстрых побед", но критично именно здесь)
При 50 nodes + 100+ edges, Linear-раскладка тянет всё на 10–20k px по X — при panning большинство edges вне viewport, но всё равно живут в DOM.

- **Метрика:** число `<path.react-flow__edge-path>` при панорамировании. Ожидание: сократится в **5–10×** в зависимости от viewport.

---

## High priority — LOD (Level of Detail)

- [x] **LOD-рендер в `SpecNode`/`ExpandedSpecNode`** через `useStore(s => s.transform[2])`:
  - `zoom < 0.3` → минимальный рендер: цветной прямоугольник + 1-2 символа
  - `0.3 ≤ zoom < 0.6` → компактный: title + kind badge, без handles visual, без sub-items
  - `zoom ≥ 0.6` → полный рендер как сейчас
  - **Метрика:** число DOM-элементов внутри одной ноды (`querySelector('.react-flow__node').querySelectorAll('*').length`). Ожидание: **15+ → 3–5** при `zoom<0.3`.
  - **Метрика:** initial render time (React Profiler). Ожидание: **≥2×** ускорения при `zoom<0.3`.

- [x] **Auto-collapse expanded nodes при zoom < 0.6** — expanded-ноды самые тяжёлые.
  - **Метрика:** при `zoom=0.5` ни одна нода не находится в expanded-состоянии (проверка через `querySelectorAll('.expanded-spec-node').length === 0`).

---

## Medium priority

- [x] **MiniMap — ограничить или скрывать** при экстремальном зуме в [App.tsx:788](viewer/app/src/App.tsx:788). Опционально заменить на статичный SVG-снапшот.
  - **Метрика:** размер SVG MiniMap viewport (`getBoundingClientRect()` в px^2) при разных zoom. Если >1M px² — скрывать.

- [x] **Мемоизация handles и badges** в [SpecNode.tsx:102-150](viewer/app/src/SpecNode.tsx) — вынести `slotTops()` и генерацию handles из рендера.
  - **Метрика:** React Profiler → "Why did this render?" для SpecNode при панорамировании. Ожидание: **0** re-renders на pan (сейчас — на каждый zoom-tick).

- [x] **Виртуальный рендер synthetic collapsed-branch nodes** в [useSpecGraphData.ts:605-687](viewer/app/src/useSpecGraphData.ts:605).
  - **Метрика:** кол-во synthetic-нод в DOM vs. в модели — должно быть ≤ visible.

- [x] **Кэш layout-позиций по `viewMode`** в [useSpecGraphData.ts:216-259](viewer/app/src/useSpecGraphData.ts:216).
  - **Метрика:** время переключения Linear ↔ Canonical (`performance.mark`+`measure` вокруг setState). Ожидание: **≥5×** быстрее после первого прохода.

---

## Low priority — UX affordance

- [x] **Hover-карточка на edge** — при наведении курсора на ребро показывать всплывающую карточку с данными: `source → target`, тип (`depends_on` / `refines` / `relates_to`), статус, и для `depends_on` — visual state (`required_satisfied` / `required_pending` / `active_blocker`). Карточка позиционируется рядом с курсором, исчезает при уходе.
  - **Контекст:** сейчас ReactFlow рендерит `label` текст прямо на ребре; карточка заменит/дополнит это в режиме hover без постоянного шума на холсте.
  - **Метрика:** пользователь может прочитать все атрибуты ребра без обращения к коду — source, target, kind, visual state.

- [x] **Tooltip/legend объяснение цветов requires-связей** — добавить в hover-tooltip рёбер и/или legend явное объяснение разницы между `required_satisfied` (зелёный), `required_pending` (янтарный) и `active_blocker` (красный), чтобы пользователь понимал, почему одна `requires`-связь зелёная, другая янтарная, третья красная.
  - **Контекст:** contract в коде уже правильный (`computeEdgeVisualState` в [useSpecGraphData.ts](viewer/app/src/useSpecGraphData.ts)), нужен только UX affordance поверх него. Текущий legend показывает только цвет линии без объяснения состояния dependency.
  - **Примеры формулировок:** `requires · satisfied (target reviewed)`, `requires · pending (target in review)`, `requires · blocked`.
  - **Метрика:** пользователь может объяснить значение цвета requires-связи без обращения к документации.

---

## Low priority / research

- [ ] **Canvas-based рендер на дальних zoom** — при `zoom < 0.3` переключаться на `<canvas>` с `fillRect`+`fillText`.
  - **Метрика:** heap при зуме 0.2 с 500 nodes (синтетический тест). Ожидание: **≤500 MB** vs. несколько GB на SVG-рендере.
  - **Порог применимости:** если граф растёт выше 200 нод.

- [ ] **Force-режим: throttle D3 tick → rAF** в [SpecForceGraph.tsx:76-246](viewer/app/src/SpecForceGraph.tsx:76).
  - **Метрика:** FPS во время force-simulation. Ожидание: **60 FPS** стабильно.

- [x] **Telemetry / diagnostics overlay** — dev-only панель с zoom/visible-nodes/FPS/heap.
  - **Назначение:** регресс-метрика для всех остальных задач этого документа.

---

## Общий протокол валидации

Для каждой гипотезы использовать следующую процедуру, чтобы результаты были сравнимы:

1. **Baseline:** свежий Safari, hard-reload, Linear + Show Blocking + Show depends_on, fit-view.
2. **Сценарий:** 10 секунд непрерывного drag-pan по разным направлениям.
3. **Метрики фиксировать:**
   - Peak JS heap (Safari Web Inspector → Timelines → Memory)
   - Peak layers (Timelines → Rendering)
   - Avg FPS (Timelines → Frames)
   - DOM node count (`document.querySelectorAll('*').length`)
4. **A/B:** применять по одной гипотезе за раз, чтобы изолировать вклад.
5. **Регресс-контроль:** повторить те же метрики в Chrome — не должны ухудшиться.

## Тест-план

- [~] Safari: 50 nodes, Linear + оба тоггла, 10s drag — heap ≤ 2 GB. _(Safari не поддерживается как primary target; animated edges убраны, stroke-dasharray сброшен на zoom<0.5)_
- [~] Safari: 50 nodes, Canonical mode — heap ≤ 1.5 GB. _(OOM на Canonical; требует canvas-рефактора или full-DOM audit — отложено)_
- [x] Chrome: regression — heap, FPS, visual не ухудшились.
- [ ] Переключения Linear ↔ Canonical ↔ Force не ломают кэш позиций.
- [ ] Клик по edge label (если H1 откатится) всё ещё селектит ребро.

---

# Recent Changes Overlay — Tasks

Бэклог развития панели "Recently Updated" (ветка `feature/recent-changes-overlay`).
Приоритеты: **P0** ship-now · **P1** next · **P2** infra-зависимые · **P3** позже · **Backlog** отложено.

## P0 — Quick wins (только фронт, ship одним PR)

- [x] **T-01 · Limit control** — футер с кнопками `25 / 50 / 100 / All`. Заменить хардкод `limit = 25` на state. ~15 строк.
- [x] **T-03 · Hotkey `R`** — toggle панели по клавише `R` (без модификаторов). Добавить в существующий keydown handler в `App.tsx`. Skip когда фокус в input/textarea. Тултип: `"Show recently updated nodes (R)"`.
- [x] **T-04 · Export as Markdown** — кнопка `📋 Copy MD` в шапке. Формат: `- **SG-SPEC-NNNN** *kind* — title (Xh ago)`. `navigator.clipboard.writeText()` + визуальное подтверждение.
- [x] **T-05 · Unread badge на кнопке** — `lastSeenAt` в `localStorage` при открытии панели; счётчик нод с `updated_at > lastSeenAt`. Расширить `PanelBtn` через `badge?: number`. Сбрасывается при открытии.

## P0+ — Группировка

- [x] **T-02 · Date group headers** — разделители `Today` · `Yesterday` · `This week` · `Older`. Bucket-функция при сортировке + `<div class="rc-group">`. ~40 строк (CSS + JSX).

## P1 — Backend-зависимые (нужен runs/ endpoint)

- [x] **T-10 · `/api/recent-runs` endpoint** *(prereq для T-11/T-12/T-20)*
  - Новый endpoint в `viewer/server.py`, возвращает последние N run-events
  - Источник: `SpecGraph/runs/*.json` — парсинг имени файла (`YYYYMMDDTHHMMSSZ-SG-SPEC-NNNN-hash.json`) + чтение первого ~1KB для `completion_status`/`run_kind`
  - Response: `[{run_id, ts, spec_id, title, run_kind, completion_status, duration_sec}]`
  - Query: `?limit=50&since=ISO8601`

- [x] **T-11 · Переключатель источника `Nodes` / `Runs`** — toggle в шапке панели. View `Runs` показывает per-event записи (одна нода может встречаться многократно). Тот же layout строки.

- [x] **T-12 · Run status icon + failed-row tint** — ✓ зелёный для `ok`, ✗ красный для `failed`. Слабый красный фон (`rgba(181,65,49,0.08)`) на failed-строках. Тултип с `run_kind` + длительностью.

## P2 — Visualization & live

- [x] **T-20 · Inline sparkline** — мини-SVG (~60×12px) с историей прогонов ноды за 7 дней, точки крашены по `completion_status`. Зависит от T-10 + per-spec агрегация.

- [x] **T-21 · Live feed via SSE** — подписка на `/api/runs-watch`. На каждый `change` дебаунс 500ms → refetch `/api/recent-runs`.
  - **Perf-guard:** дебаунс 500ms, sharedRunsFetch(force=true) обходит cache, EventSource закрывается на toggle-off
  - Toggle `🔴 live / ⏸ live` в шапке (default: paused — opt-in)
  - Backend: RunsWatcher polls runs/ every 2s; one thread for all clients; exits when last subscriber leaves

## P3 — Cross-tool integration

- [x] **T-30 · Timeline ↔ Recent connector** — клик по записи выставляет `timelineRange` в `[ts - 1h, ts + 1h]`, переключает Recent → Timeline (mutex закрывает Recent), пан + select ноды. `timelineField` форсируется в `updated_at` для согласованности с тем, что показывал Recent. Hover-highlight на графе отложен (модерат-польза vs пропс-дриллинг через `displayNodes`).

## Pending SpecGraph contract — `spec_activity_feed.json` (T-40)

**Контекст.** Текущие источники Recent Changes (`Nodes` и `Runs`) концептуально слепы к
trace/evidence baseline PR'ам и другой активности, которая не трогает каноническую
YAML-ноду. SpecGraph — канонический владелец семантики "что такое значимое обновление
spec node", не viewer. Договорённость: SpecGraph публикует нормализованный artifact;
ContextBuilder только читает и рендерит.

- [x] **T-40a · Inline scope hint** — `ⓘ` индикатор в шапке с tooltip, объясняющим
  текущий охват: "Shows YAML updates (Nodes) and refine runs (Runs); broader activity
  arrives once SpecGraph publishes spec_activity_feed.json."

- [ ] **T-40b · Activity feed reader** *(блок: SpecGraph PR с artifact)*
  - **Контракт от viewer (на согласование с SpecGraph):**
    - Path: `<specgraph>/runs/spec_activity_feed.json`
    - Shape: `{ events: [{ event_id, ts, spec_id, event_type, summary?, source_ref? }] }`
    - `event_type` (расширяемый enum):
      - `canonical_spec_updated`
      - `trace_baseline_attached`
      - `evidence_baseline_attached`
      - `proposal_emitted`
      - `implementation_work_emitted`
      - `review_feedback_applied`
    - Backend: `GET /api/spec-activity?limit=N&since=ISO`, парсинг по аналогии с
      `/api/recent-runs`
    - Frontend: третий source-toggle "Activity" (или замещение Nodes/Runs если SpecGraph
      признает feed каноничным). Цвет/иконка → таблица per-event_type. Sparkline
      переезжает с `runs/` на этот feed для полной истории.
    - SSE live: расширить `RunsWatcher` или добавить отдельный watcher на файл feed'а.

- [ ] **T-40c · Deprecate Runs source** *(только после стабильной T-40b)* — если
  Activity feed покрывает refine events, Runs toggle снять; иначе оставить как
  низкоуровневую диагностику.

**Что НЕ делаем сейчас:**
- ❌ "Commits" source mode в viewer (git log по специфическим путям). Решает symptom,
  но дублирует логику, которая должна жить в SpecGraph; стало бы permanent fallback'ом.
- ❌ Параллельный git-builder в viewer.

## Backlog (отложено)

- **Delta-сравнение** между двумя runs (`status: outlined → specified`, `maturity 60% → 100%`). Требует чтения и diff двух run-файлов. Подобрать после стабилизации T-11.

---

## Порядок исполнения

1. **T-01, T-03, T-04, T-05** — pure-frontend, один PR
2. **T-02** — group headers, второй мелкий PR
3. **T-10** — backend endpoint (foundation)
4. **T-11, T-12** — runs feed + status visuals
5. **T-20** — sparkline (после стабилизации формы T-11)
6. **T-21** — SSE live (последним, после perf-теста)
7. **T-30** — Timeline integration (полировка)

