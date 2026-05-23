# CONTRIBUTING (SpecSpace / ContextBuilder rewrite)

Этот документ фиксирует практические правила, которые реально использовались в ходе переписывания ContextBuilder в SpecSpace.

## 1) Основные правила работы

- Следуем FSD для `graphspace` и существующему архитектурному стилю проекта.
- По возможности используем `rg` для поиска (`rg`/`rg --files`), избегаем `grep`.
- Минимизируем риски через маленькие PR/stacks с понятным scope.
- Перед слиянием любого PR:
  - закрытые review threads;
  - зелёные проверки CI-джоб;
  - валидируем локально в рамках зоны изменений (не гоняем весь проект без нужды).
- Для frontend-работ используем:
  - локальный запуск backend: `8001`;
  - frontend: `5173`;
  - проверяем, что UI показывает актуальное поведение без регресса старого ContextBuilder;
  - для UI PR обязательно делать smoke как минимум в desktop и mobile viewport.

## 2) Архитектурные правила, которые уже доказали свою ценность

- Не привязываем логику к одному хостеру:
  - все инфраструктурные переменные/настройки в конфиг/CI лучше именовать нейтрально (`deploy-*`), а не `timeweb-*`.
- Не строим монолитный `server.py`/frontend:
  - выделяем handlers, парсеры, runtime, API helpers и общие рид-модели на отдельные модули.
- Для API-взаимодействий и ошибок:
  - строго типизируем payloads;
  - explicit failure contracts вместо «тихих» падений;
  - не возвращаем ложные 200/503 без диагностического контекста.
- Для UI-сущностей (Spec ID и проч.):
  - сначала «resolver by graph data», потом только рендер/вывод кликабельности;
  - не полагаемся на жёсткие regex по шаблонам вроде `SG-SPEC-*`.
- По состоянию и панелям:
  - отделяем canvas/инфраструктурные overlays/panels по ответственностям;
  - сохраняем предсказуемый layout и устойчивый fallback при ошибках live-загрузки.

## 3) FSD + слои, которые часто ломаются

- `pages` — композиция только.
- `widgets` — поведение UI (но без бизнес-переиспользования сущностей).
- `entities` — доменные модели и операции над ними.
- `shared` — утилиты/компоненты/типовые хуки без бизнес-зависимостей.
- Избегаем циклических импортов и сильной связности между уровнями.

## 4) Нюансы, выработанные в процессе (без повторения ошибок)

### Live data и polling/watch
- SSE/watch endpoints лучше держать устойчивыми:
  - отдельная логика реконнекта;
  - корректная обработка `open/reopen` и смены состояния вместо только `change`.
- При 503/ошибках backend не «обнуляем» UI без причины; показываем явный status с диагностикой.

### Proposal/Agent workflows
- Контекст агента должен поддерживать расширяемые типы (`spec_node`, `spec_edge`, future spec/proposal markers).
- Для preview/hover/inspector лучше избегать резких скачков высоты:
  - резервировать placeholder/space до загрузки async-текста.
- В списках избегаем скрытых hard limits (например `slice(0, 8)`), лучше ограничение через явную конфигурацию и тест.

### UI parity with old ContextBuilder
- Критичные parity-проходы:
  - панель navigator/spec list;
  - proposer/conversation baseline;
  - metrics/coverage visibility;
  - отсутствие конфликтов z-index/overlay поверх canvas.
- Не ломим UX-образ старого ContextBuilder без альтернативы в новой навигации.
- Для React Flow canvas задаём deterministic `initialWidth`/`initialHeight` у custom nodes:
  без них `MiniMap` может не отрисовать node rectangles, даже если сами nodes видны на canvas.
- Canvas parity переносим из старого ContextBuilder избирательно:
  - сначала deterministic presets (`Tree`, `Linear`, `Spine`, `Canonical`, `Status`);
  - `Spine`/tidy DAG layout нужен для readable large-graph maps: depth задаёт колонку, sibling anchors по `refines` равномерно распределяются вокруг parent, descendants раскрываются вокруг child anchor, а secondary links не двигают nodes;
  - dense edges должны идти через edge-detail/LOD controls (`Auto`, `Main`, `Core`, `Links`, `All`) и edge routing (`Curve`, `Rect`), а не как always-on rendering;
  - `Auto` на дальнем zoom должен уметь скрывать пунктирные `refines`, потому что они легко перекрывают основные directional links;
  - `Auto` edge detail должен учитывать активный layout: для плотных layouts вроде `Spine` и `Status` держим sparse `Main` дольше, а явные `Core`/`Links`/`All` не переопределяем;
  - `refines` в graph contract хранится как `child -> parent`, но Tree/Linear/Spine/Status показывают hierarchy projection `parent -> child`; Canonical должен оставаться raw-direction layout;
  - subtree collapse должен скрывать descendants на уровне visible graph перед layout calculation, иначе на canvas остаются большие пустые разрывы от спрятанных веток;
  - legacy `Force` был отдельной D3 SVG-сценой, а не React Flow layout preset, поэтому возвращаем его только как guarded/opt-in режим с явным budget и smoke;
  - dense labels, long always-on edges, animations and dashed/filtered SVG effects требуют отдельного performance pass;
  - Safari особенно чувствителен к большому числу детальных nodes и длинных edges, поэтому перед возвратом таких фич нужны edge-density controls/LOD и desktop+mobile smoke.

## 5) Практика работы с PR-стеками

- При большой серии изменений:
  - сначала utility/cleanup PR,
  - затем decomposition,
  - потом интеграционные/UX/edge-case PR.
- PR-стек должен мержиться в последовательном порядке в `main`.
- После каждого крупного PR фиксируем статус/следующую задачу в `SPECS/INPROGRESS/next.md`.

## 6) Деплой и Timeweb: важные правила

- Для Timeweb-деплоя использовать отдельный файл/branch (как уже отлажено с `timeweb-deploy`) и проверять CI-пассы.
- Важно отделять фронт-артефакты и artifact deploy, чтобы не затирать shared hosting root (критично для landing / static.
- Логи Timeweb часто лучше всего диагностировать через:
  - статус 502/503 на API path;
  - ошибки upstream контейнеров;
  - отсутствующие registry/auth ошибки в compose pull.
- Если после `latest` в `timeweb` не отражается новый билд:
  - проверить, что CI действительно пушит новые образы/теги;
  - убедиться в корректной ветке deploy branch и отсутствии ручного stale-state кэшей.

## 7) Проверки и диагностика

- Минимальный чек перед handoff:
  - `npm run lint:fsd --prefix graphspace`;
  - `npm run build --prefix graphspace`;
  - `npm test --prefix graphspace` по релевантным зонам;
  - `make test` backend при затрагивании Python/API.
- Для UI-списков/панелей: руками открыть страницу и проверить:
  - корректную отрисовку после пустых/частично поломаных endpoints;
  - отсутствие «полей-артефактов» из‑за scrollbars и контейнеров;
  - читаемость статусов/баджей и консистентность цветов.
- Для viewport smoke:
  - desktop: широкий рабочий viewport, где одновременно видны canvas, Sidebar/Utility/Inspector;
  - mobile/narrow: примерно `390x844`, особенно если менялись `position: fixed`, rail/panel heights, scroll containers, overlays, bottom status bar или toolbar;
  - проверять не только наличие панели, но и достижимость нижнего контента через scroll.

## 8) Рекомендованная структура «быстрого старта» для нового участника

1. Обновить `main` и прочитать текущий `SPECS/Workplan.md` + `SPECS/INPROGRESS/next.md`.
2. Пройти последний merged PR, понять текущий state UI (canvas/utility/agent panels).
3. Проверить Timeweb/CI статус для последнего релиза.
4. Выбирать следующую задачу из плана и делать маленький, изолированный PR.

## 9) Что делать с этим файлом

- `CONTRIBUTING.md` — для onboarding и правил код-ревью.
- Если появляются новые важные нюансы (например новый deploy-провайдер, новые guardrails для SpecPM/SpecGraph), добавлять в этот документ отдельным пунктом.
