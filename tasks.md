# Specs Graph — Performance & Memory Improvements

Контекст: в Safari при отображении ~50 spec-nodes в режиме **Linear** с включёнными тогглами **Show Blocking** + **Show depends_on** панорамирование раздувает память до 5–6 GB (в Chrome — ~1 GB). Ранее при `minZoom=0.125` появлялись розовые области canvas и зависал MacBook до watchdog-перезагрузки.

**Установленная причина №1 (zoom):** Safari превышает лимит GPU-текстуры (~16384px / ~268M pixels) при CSS `transform: scale()` на множестве composite-layers от expanded-нод.

**Рабочая гипотеза №2 (Linear + Blocking + depends_on):** дефолтные bezier SVG `<path>` через широкий Linear-viewport + HTML-лейблы через `<EdgeLabelRenderer>` + `strokeDasharray` — комбинация, которую Safari растрирует на порядок дороже, чем Chrome/Skia.

---

## ✅ Done

- [x] **Clamp zoom range** — в [App.tsx:775-776](viewer/app/src/App.tsx:775) поднят `minZoom: 0.125 → 0.4`, добавлен `maxZoom: 2`. Отсекает "death zone", где Safari падает при экстремальном зум-ауте.

---

## High priority — быстрые победы

- [ ] **`onlyRenderVisibleElements={true}`** на `<ReactFlow>` в [App.tsx:764](viewer/app/src/App.tsx:764). Ноды/рёбра вне viewport не рендерятся.
  - **Метрика:** `performance.memory.usedJSHeapSize` (Chrome) / Safari Web Inspector → Timelines → Memory при панорамировании через 3-4 viewport-а. Ожидаемое снижение: **≥30%** пикового heap.
  - **Доп. метрика:** `document.querySelectorAll('.react-flow__node').length` до/после — в viewport должно остаться ≤ visible нод + небольшой buffer.

- [ ] **CSS-класс `zoomed-out`** на контейнере при `zoom < 0.5`: убрать `box-shadow`, `filter`, `backdrop-filter`, `border-radius` у `.react-flow__node`. Форсируют отдельные GPU-текстуры в Safari.
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

### H2. `type: "straight"` вместо `"default"` для Linear mode
**Файл:** [useSpecGraphData.ts:357,383,404,423](viewer/app/src/useSpecGraphData.ts:357)

В Linear ноды стоят на одной горизонтали — bezier-кривые избыточны. Прямые линии = короче SVG path string, быстрее Safari path rasterization.

- **Метрика:** FPS при панорамировании (Safari Web Inspector → Timelines → Frames). Ожидание: **≥45 FPS** стабильно (сейчас проседает под 20 FPS).
- **Доп. метрика:** длина `d` атрибута `<path>` суммарно по всем edges до/после (через `document.querySelectorAll('path.react-flow__edge-path').reduce((s,p)=>s+p.getAttribute('d').length,0)`). Ожидание: **≥40%** сокращения.

### H3. Убрать `strokeDasharray` у Linear backward edges
**Файл:** [useSpecGraphData.ts:120-124,113-117](viewer/app/src/useSpecGraphData.ts:120) — `LINEAR_BACKWARD_STYLE`, `TREE_CROSSLINK_STYLE`

Safari кэширует dasharray-паттерн отдельной текстурой на каждую уникальную комбинацию (pattern × color × width × scale). Заменить на solid line другого оттенка.

- **Метрика:** bisect — включить H1+H2, замерить heap; добавить H3, замерить ещё раз. Изолирует вклад dasharray.
- **Ожидание:** дополнительно **10–20%** heap.

### H4. `onlyRenderVisibleElements={true}` (дубль из "быстрых побед", но критично именно здесь)
При 50 nodes + 100+ edges, Linear-раскладка тянет всё на 10–20k px по X — при panning большинство edges вне viewport, но всё равно живут в DOM.

- **Метрика:** число `<path.react-flow__edge-path>` при панорамировании. Ожидание: сократится в **5–10×** в зависимости от viewport.

---

## High priority — LOD (Level of Detail)

- [ ] **LOD-рендер в `SpecNode`/`ExpandedSpecNode`** через `useStore(s => s.transform[2])`:
  - `zoom < 0.3` → минимальный рендер: цветной прямоугольник + 1-2 символа
  - `0.3 ≤ zoom < 0.6` → компактный: title + kind badge, без handles visual, без sub-items
  - `zoom ≥ 0.6` → полный рендер как сейчас
  - **Метрика:** число DOM-элементов внутри одной ноды (`querySelector('.react-flow__node').querySelectorAll('*').length`). Ожидание: **15+ → 3–5** при `zoom<0.3`.
  - **Метрика:** initial render time (React Profiler). Ожидание: **≥2×** ускорения при `zoom<0.3`.

- [ ] **Auto-collapse expanded nodes при zoom < 0.6** — expanded-ноды самые тяжёлые.
  - **Метрика:** при `zoom=0.5` ни одна нода не находится в expanded-состоянии (проверка через `querySelectorAll('.expanded-spec-node').length === 0`).

---

## Medium priority

- [ ] **MiniMap — ограничить или скрывать** при экстремальном зуме в [App.tsx:788](viewer/app/src/App.tsx:788). Опционально заменить на статичный SVG-снапшот.
  - **Метрика:** размер SVG MiniMap viewport (`getBoundingClientRect()` в px^2) при разных zoom. Если >1M px² — скрывать.

- [ ] **Мемоизация handles и badges** в [SpecNode.tsx:102-150](viewer/app/src/SpecNode.tsx) — вынести `slotTops()` и генерацию handles из рендера.
  - **Метрика:** React Profiler → "Why did this render?" для SpecNode при панорамировании. Ожидание: **0** re-renders на pan (сейчас — на каждый zoom-tick).

- [ ] **Виртуальный рендер synthetic collapsed-branch nodes** в [useSpecGraphData.ts:605-687](viewer/app/src/useSpecGraphData.ts:605).
  - **Метрика:** кол-во synthetic-нод в DOM vs. в модели — должно быть ≤ visible.

- [ ] **Кэш layout-позиций по `viewMode`** в [useSpecGraphData.ts:216-259](viewer/app/src/useSpecGraphData.ts:216).
  - **Метрика:** время переключения Linear ↔ Canonical (`performance.mark`+`measure` вокруг setState). Ожидание: **≥5×** быстрее после первого прохода.

---

## Low priority / research

- [ ] **Canvas-based рендер на дальних zoom** — при `zoom < 0.3` переключаться на `<canvas>` с `fillRect`+`fillText`.
  - **Метрика:** heap при зуме 0.2 с 500 nodes (синтетический тест). Ожидание: **≤500 MB** vs. несколько GB на SVG-рендере.
  - **Порог применимости:** если граф растёт выше 200 нод.

- [ ] **Force-режим: throttle D3 tick → rAF** в [SpecForceGraph.tsx:76-246](viewer/app/src/SpecForceGraph.tsx:76).
  - **Метрика:** FPS во время force-simulation. Ожидание: **60 FPS** стабильно.

- [ ] **Telemetry / diagnostics overlay** — dev-only панель с zoom/visible-nodes/FPS/heap.
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

- [ ] Safari: 50 nodes, Linear + оба тоггла, 10s drag — heap ≤ 2 GB.
- [ ] Safari: 50 nodes, Canonical mode — heap ≤ 1.5 GB.
- [ ] Chrome: regression — heap, FPS, visual не ухудшились.
- [ ] Переключения Linear ↔ Canonical ↔ Force не ломают кэш позиций.
- [ ] Клик по edge label (если H1 откатится) всё ещё селектит ребро.
