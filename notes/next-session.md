# Next Session Plan - Abuse-App

## Snapshot (2026-02-27) — ефекти тем

### Закрито в цій сесії
- Themes: повністю замінено tsParticles на кастомний Canvas-рендер сезонних ефектів; нові ефекти — Сакура/Дощ/Опале листя/Сніг.
- Themes: оновлено перемикачі ефектів у налаштуваннях, додано регулятори швидкості для Сакури/Дощу/Опалого листя; сніг залишив повзунок швидкості.
- Themes: прибрано “перемотку” при зміні швидкості — швидкість оновлюється плавно без ресету частинок.
- Themes: тюнінг траєкторій/швидкостей (без діагоналі для Сакури/Дощу/Опалого листя, повільніші коливання для снігу/сакури, дощ — тонкі довші смуги).
- Themes: опале листя — м’якші коливання та баланс спавну по ширині (35% центр, 32.5% ліва, 32.5% права).
- UI: прибрано `bg-black` та inline `backgroundColor` з основних сторінок (Telegram/Settings/Chrome/NotFound), фон перенесено на `body` в App.
- Dev: прибрано залежності `tsparticles` і `@tsparticles/react`.

### Перевірки
- `npm run check` — проходить.

### Відкриті питання
- Ефекти все ще не видно під контентом — потрібна подальша діагностика шарів/фонів.

## Snapshot (2026-02-27)

### Закрито в цій сесії
- Telegram: стабілізовано закриття батчів — додано ретраї закриття по папках та визначення реальних PID за `TG N` (нова команда `get_telegram_pids_for_accounts`), F6 тепер закриває надійніше.
- Telegram: прибрано логування в “Останні дії” для відкриття/закриття акаунта і повідомлення “Продовжено запуск…”. Повідомлення про кастомне посилання змінено на “Запущено своє посилання <name>”, завершення — “Завершено <name>”.
- Daily Tasks: при позначенні задачі як виконаної очищаються нагадування; в модальному “Заплановано” показуються лише майбутні ненагадані записи.
- Telegram: toasts для нотаток/назви акаунта показують номер картки (index+1), а не внутрішній ID; логування цих дій у “Останні дії” прибрано.
- Themes: інтегровано tsParticles (Winter/Spring/Summer/Autumn), увімкнено перемикачі сезонів у налаштуваннях, виправлено ініціалізацію через `initParticlesEngine` та фіксований контейнер.
- Dev: після оновлення Node до 25.6.1 перебудовано `better-sqlite3`; у `server/index.ts` прибрано `reusePort` і змінено host на `127.0.0.1` для Windows.

### Перевірки
- `npm run check` — проходить.

## Snapshot (2026-02-26)

### Закрито в цій сесії
- Виправлено шлях збірки Tauri: `frontendDist` тепер `../dist/public`.
- Daily Tasks: при виконанні задачі нагадування більше не скидаються.
- Daily Tasks: додано підтримку кількох нагадувань на одну задачу, оновлено планувальник і UI редагування.
- Daily Tasks: прибрано кнопку “Додати нагадування”, додавання відбувається через “Зберегти”; інпути дати/часу очищаються після збереження.
- Виправлено тексти toast для нотаток у Telegram: “Нотатку оновлено”, опис “Акаунт {назва}”.
- Видалено сторінку `Accounts` і маршрут `/accounts`.
- Картки акаунтів у Telegram: показ нумерації 1..N, hover-підміна на `account.name`, кнопка копіювання назви з’являється при наведенні.
- Виправлено кодування `notes/next-session.md` (UTF-8).

### Перевірки
- `npm run check` — проходить.

## Snapshot (2026-02-26) — доповнення

### Закрито в цій сесії
- Telegram: додано закриття акаунтів по папках `TG N` як другий прохід (нова команда `close_telegram_accounts_batch`), викликається після закриття PID-ів при F6 та при “Закрити всі”.
- Telegram UI: кнопка “Скасувати” в блоці прогресу перейменована на “Завершити”.
- Іконки: згенеровано padded-джерело `assets/icon-source-1024.png` і перегенеровано всі іконки через `npx tauri icon` (включно `icon.ico`) для виправлення мильних/обрізаних ярликів.

## Snapshot (2026-02-26) — фікс іконок Windows (повторно)

### Закрито в цій сесії
- Проведено діагностику проблеми мильних/обрізаних іконок після перевстановлення: підтверджено, що `src-tauri/icons/icon.ico` був неякісним для Windows-випадку (не давав стабільного результату для taskbar/desktop/tray).
- Іконки перегенеровано вручну з `assets/logo-square.png` з контрольованими відступами та масштабом: оновлено `32x32.png`, `64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.png`.
- Зібрано новий `src-tauri/icons/icon.ico` як multi-size (16/20/24/32/40/48/64/72/96/128/256) для чіткого рендеру на різних щільностях Windows.
- Додано окремі іконки для трею: `src-tauri/icons/tray-icon.png` та `src-tauri/icons/tray-icon@2x.png` (щільніший кроп, без ефекту «дуже маленької» іконки).
- Оновлено `src-tauri/src/lib.rs`: tray тепер використовує `tauri::include_image!("icons/tray-icon.png")` замість `app.default_window_icon()`.
- Піднято версію застосунку до `1.0.2` у `src-tauri/tauri.conf.json` та `src-tauri/Cargo.toml` (щоб Windows гарантовано підхопила нові ресурси іконок).
- Зібрано нові інсталятори `1.0.2`:
  - `src-tauri/target/release/bundle/nsis/AbuseApp_1.0.2_x64-setup.exe`
  - `src-tauri/target/release/bundle/msi/AbuseApp_1.0.2_x64_en-US.msi`

### Перевірки
- `cargo check` — проходить.
- `npm run check` — проходить.
- `npm run tauri:build` — проходить.

### Важливо для встановлення
- Після оновлення до `1.0.2` на Windows потрібно відкріпити старий pinned-ярлик з taskbar і закріпити знову після першого запуску нової версії, інакше може лишатися старий icon cache.

## Snapshot (2026-02-26) — Telegram акаунти (UI/імена)

### Закрито в цій сесії
- Telegram: додано локальне поле `displayName` для акаунтів (meta), без зчитування з `tdata`.
- Telegram UI: редагування імені через клік по номеру/імені; інпут мінімалістичний (прозорий, лише курсор + плейсхолдер `@user`).
- Telegram UI: якщо `displayName` порожній — не показується назва іконка копіювання; якщо є — при hover номер замінюється на ім’я і з’являється іконка копіювання.
- Telegram UI: іконка “додати хештег” перенесена в правий верхній кут картки; при наявності копіювання стає перед нею, без копіювання займає її місце.
- Telegram UI: хрестик видалення хештегу показується лише при наведенні на сам хештег.
- Telegram UI: плейсхолдер пошуку змінено на “Пошук”; лупа ховається при фокусі, відступ зліва прибирається під час вводу.

### Перевірки
- `npm run check` — проходить.

## Snapshot (2026-03-04) - Chrome page: close by window handle, batch UX rollback, Open all by threads

### Done in this session
- Chrome / Windows close behavior: replaced single-profile close flow with HWND + WM_CLOSE approach (no forced process kill in single-close flow).
- Chrome / single-close stability: added window-handle caching on launch and improved close reliability with retries.
- Chrome / account card UX: reduced open/close button flicker by stabilizing pending-state reconciliation with polling.
- Chrome / Recent actions widget: hidden technical lines "Chrome launch:*" and "Chrome close:*" from the Chrome Recent actions feed.
- Chrome / project select UX: added and then conditioned "Clear selection" item (shown only when a project is selected).
- Chrome / custom-link flow: implemented and then fully removed by request (including modal, state, and related launch plumbing).
- Chrome / mass-launch rollback: removed previously added custom/mass-launch range logic per request; kept core card-based open/close behavior.
- Chrome / Open all button: added in Mass launch widget with Telegram-like visual style and placement in the header row.
- Chrome / Open all behavior: reworked to respect Chrome Threads ("Opened simultaneously") and run in batches.
- Chrome / batch controls: progress bar + Continue + Finish restored for the Open-all session flow.
- Chrome / Finish reliability: aligned close retries in batch actions with per-card close behavior (multi-attempt with short backoff).

### Verification
- npm run check - passed multiple times after frontend changes.
- cargo check - passed after Rust/Tauri changes.

## Snapshot (2026-03-04) - Chrome Mass launch parity with Telegram, custom-link flow, batch finishing polish

### Done in this session
- Chrome / Finish action: fixed batch finish close detection so `Finish` closes recently opened profiles reliably (fresh running-profile read + active batch state fallback).
- Chrome / Mass launch project UX: replaced temporary "Add project" header button with Telegram-like project row inside widget.
- Chrome / Project row: added Select with project list, `Custom link`, and conditional `Clear selection` (visible only when something is selected).
- Chrome / Add project: wired `+` button in project row to `ProjectModal` for Chrome-only projects.
- Chrome / Custom link: wired `CustomLinkModal` in Chrome flow and connected selected/custom URL to profile launch target.
- Chrome / Custom link validation: added generic URL mode for Chrome (`http/https`), keeping Telegram validation intact for Telegram mode.
- Chrome / Modal placeholders: replaced Telegram-specific placeholder with neutral URL placeholder on Chrome (`https://example.com`).
- Chrome / Keyboard flow: after saving custom link, focus jumps to `Start`; Enter in `Start` moves to `End`; Enter in `End` launches.
- Chrome / Mass launch controls: added `Start`, `End`, `Enable "Mix" mode`, and `Launch` button with Telegram-like styling/behavior.
- Chrome / Range launch logic: launch by ordinal range over sorted available (non-blocked) profiles; optional shuffle when Mix is enabled.
- Chrome / Layout parity: aligned Mass launch widget structure to Telegram (`space-y-4` form area + separate bottom actions area).
- Chrome / Open all visibility: `Open all` no longer disappears while batch session is active.
- Chrome / Open all autofill: on `Open all`, auto-fills `Start=1`, `End=<available profiles count>`, and sets select label to `Opening all`.
- Chrome / Finish reset: after `Finish`, Mass launch widget state is fully reset (project, range, custom link, batch state); Mix defaults back to enabled.
- Chrome / Continue button visibility: `Continue` now renders only when there are actual pending profiles left to open (handles pre-opened accounts correctly).
- Chrome / Range autofill fix: removed misleading max-ID range (`...159` style); range now reflects launch-order positions.

### Verification
- `npm run check` - passed after each logical change batch.

## Snapshot (2026-03-04) - Chrome follow-up fixes (status sync, stats refresh, batch UX)

### Done in this session
- Chrome / account card status sync: fixed stale `X` state after manual browser-window close (outside the app) by improving running-profile reconciliation.
- Chrome / pending-state cleanup: hardened pending-state expiration so external/manual close no longer keeps card in active state.
- Chrome / Stats widget: added Telegram-like refresh icon button in Accounts stats widget (top-right), with in-flight lock and spin animation.
- Chrome / Open all UX: kept `Open all` button always visible during batch session.
- Chrome / Open all autofill: project select now shows `Opening all`; range fields auto-fill using launch-order positions.
- Chrome / range semantics: switched Start/End handling to ordinal positions over available (non-blocked) accounts; removed confusing max-id behavior.
- Chrome / batch actions: when there is nothing left to continue, `Continue` button is hidden and only `Finish` remains.
- Chrome / custom-link flow: after saving custom link, focus jumps to `Start`; Enter -> `End`; Enter -> launch.

### Verification
- `npm run check` - passed after each fix.

## Snapshot (2026-03-05) - Оновлення чолки, панелі тем, логів

### Зроблено в цій сесії
- Чолка / правий блок: об'єднано капсулу теми та капсулу кнопок керування вікном в одну капсулу.
- Чолка / іконка теми: прибрано підсвітку фону при наведенні (`hover:bg-transparent active:bg-transparent`).
- Панель тем / картки ефектів: повернуто фон активної картки (`bg-primary/10`).
- Панель тем / прев'ю: прибрано зайвий фон під міні-віджетами (`.theme-preview-surface` має прозорий фон і без blur).
- Панель тем / тексти: виправлено поламані рядки в `ThemeControlPanel.tsx` (`Тема`, `Ефекти`, `Закрити`, `Поки що немає тем`, `Увімкнути/Вимкнути`).
- Віджет "Останні дії": виправлено поламані локалізовані рядки в `LogsPanel.tsx`.
- Telegram / кастомне посилання: прибрано дубльований запис у логах на етапі додавання посилання.
- Результат у логах: для кастомного посилання лишається `Запущено <name>`, а після завершення `Завершено <name>`.

### Змінені файли
- `client/src/App.tsx`
- `client/src/index.css`
- `client/src/components/ThemeControlPanel.tsx`
- `client/src/components/LogsPanel.tsx`
- `client/src/pages/Telegram.tsx`

### Перевірка
- `npm run check` - пройшов після кожного блоку змін.

## Snapshot (2026-03-05) - Sidebar: візуальні лінії

### Зроблено в цій сесії
- Sidebar: прибрано ліву лінію-індикатор активного пункту для іконок Telegram/Chrome/Календар/Налаштування.
- Sidebar: прибрано лінію-розділювач між блоком логотипа та списком іконок (між логотипом і Telegram).

### Змінені файли
- `client/src/components/Sidebar.tsx`

### Перевірка
- `npm run check` - пройшов.
