## Snapshot (2026-03-01) - Calendar page (full-screen UX + Daily planned badges)

### Закрито в цій сесії
- Calendar page: прибрано toggle-кнопку режимів і повністю видалено блок "Зустрічі"; залишено лише календарну сітку.
- Calendar layout: перероблено на full-page сценарій (ширина на весь контейнер), повернуто вертикальний скрол сторінки, додано sticky-шапку (місяць + дні тижня).
- Calendar month grid: замінено технічні `+/-` клітинки на реальні дні попереднього/поточного/наступного місяця з тьмяним стилем для неактивних днів.
- Daily integration: кульки в календарі тепер беруться з реальних Daily reminders (логіка як у "Заплановано"): враховуються тільки `!remindedAt` і `remindAt > now`; підрахунок агрегується по даті.
- Calendar header: у заголовку залишено лише назву місяця (без року).
- Calendar visuals: повернуто фіолетовий фон сторінки (deco blur-шар).
- Badge UX: прибрано проблемну анімацію "телепорту/тряски"; залишено м’яку анімацію переміщення бейджа з кута в центр при hover, без контурної підсвітки.
- Badge positioning: підкориговано відступ від кута в неактивному стані (`right/bottom`), щоб не налазило на скруглення.
- Encoding: виправлено UTF-8 для календарних файлів після тимчасових артефактів `��`.
- Local logs sanitize: посилено очистку зламаних символів `\uFFFD` у `localStore.sanitizeLogMessage`.
- Telegram / Mass launch stop: посилено логіку "Завершити" після навігації між сторінками (Settings <-> Telegram) — додано `stop/cancel/finishing` guard-и, mutex для `Continue`, fallback-закриття PID-ів по запущених процесах у межах `telegramFolderPath`, multi-sweep після cancel.
- Telegram / Mass launch stop: додано module-level "stop barrier" (тайм-аутний глобальний блок) для захисту від повторного запуску батчу зі старих async-ланцюжків після remount сторінки.
- Telegram / Progress restore: розширено персист/рестор `telegramLaunch`-стану (`isLaunching`, `launchProgressCount`, `launchMode`) для стабільного відновлення прогрес-бара після переходів між сторінками.
- Sidebar UX: виправлено нерозгортання сайдбара на desktop — поріг narrow viewport змінено з `1280px` на `1024px`.
- Calendar page (temporary): замість інтерактивного календаря встановлено чорну заглушку "Сторінка знаходиться в процесі розробки" у стилі сторінки Chrome.
- Chrome page (temporary text): заголовок встановлено як `Chrome`, підпис повернуто з i18n (`t("chrome.description")`).

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` - проходить.
## Snapshot (2026-02-28) - Daily behavior / Select UX / Windows taskbar icon

### Закрито в цій сесії
- Project modal: посилено анти-autofill для "Додати/Редагувати проєкт" (динамічні `id/name` на кожне відкриття, `autoComplete="off"`, hidden decoy-поля, `readOnly` до першого фокусу/кліку), щоб прибрати підстановку збережених значень при кліку в інпут.
- Daily Tasks: змінено поведінку completion — майбутні reminder-и більше не видаляються при встановленні галочки.
- Daily Tasks: прибрано примусове правило `future reminder => isCompleted: false`; тепер чекбокс можна ставити/знімати незалежно від наявності майбутніх нагадувань.
- Daily Tasks: синхронізовано це правило у всіх шляхах оновлення (`getDailyTasks`, `updateDailyTask`, `updateDailyTaskReminder`, `addDailyTaskReminder`, `updateDailyTaskReminderEntry`), без автоскидання checked-стану.
- Telegram / Mass launch / Project select: виправлено обрізання правого краю dropdown (`SelectContent` вирівняно від тригера, адаптивна ширина від `--radix-select-trigger-width`).
- Telegram / Mass launch / Project select: контент елементів списку вирівняно зліва (включно з `name + ref_link`), прибрано "розліт" елементів по рядку, додано стабільний `truncate`.
- Telegram / Mass launch / Project select: прибрано ефект підсвітки рамки trigger-поля після виходу курсора зі списку.
- Settings / Language select: прибрано підсвітку рамки trigger-поля (аналогічно до Telegram).
- Settings / Language select: зафіксовано відкриття dropdown донизу (`side="bottom"`, без auto-flip), додано внутрішній scroll (`max-height + overflow-y-auto`) для сценаріїв, коли знизу мало місця.
- Windows taskbar icon: проведено діагностику (перевірено `icon.ico` і конфіг); додано явний виклик `SetCurrentProcessExplicitAppUserModelID("com.abuseapp.desktop")` на старті застосунку для стабільнішого матчингу іконки на першому запуску після інсталяції.
- Tauri/Rust: для цього підключено `windows-sys` feature `Win32_UI_Shell`.

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` - проходить.
- `cargo check` - проходить.
## Snapshot (2026-02-28) - Daily visibility + Calendar rebuild

### Закрито в цій сесії
- Daily widget: задачі з майбутніми нагадуваннями тепер ховаються з віджета, якщо до найближчого reminder більше `24h`; автоматично з’являються при вході у вікно `<=24h`.
- Daily state: виправлено кейс із “залиплим” checked-станом - якщо у задачі є активне майбутнє нагадування, вона примусово нормалізується в `isCompleted: false` (у `localStore` при читанні та при оновленнях reminder-ів).
- Daily modal time row: прибрано сірий “приклад” часу (`placeholder`) під час фокусу/кліку в полі часу.
- Daily modal “Заплановано”: повернуто коректну поведінку - показує майбутні planned-reminder записи без 24h-фільтра (не лише ті, що вже видно у віджеті Daily).
- Calendar widget (Telegram right column): компонент `glass-calendar` перезібрано з нуля для стабільного layout (місяць + стрілки + 5-денна карусель), прибрано зайві нижні кнопки/лінію, підправлено відступи та пропорції капсул.
- Calendar UX: коліщатко миші на каруселі перемикає дні; додано жорстке блокування wheel-прокрутки сторінки при hover над каруселлю.
- Calendar UX: при відведенні курсора з каруселі - без анімації - повернення до поточного дня, якщо користувач відскролився “далеко” (поріг у днях).
- Calendar header: рік у заголовку показується тільки для непоточного року; між місяцем і роком додано контрольований відступ.
- Encoding fix: повторно виправлено зламані кириличні підписи в календарі (`Р...` -> нормальний UTF-8 текст для `uk/ru`).

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` - проходить.
## Snapshot (2026-02-28) - launch stability / tray / logs

### Закрито в цій сесії
- Notes: прибрано застарілий пункт у відкритих питаннях про невидимі ефекти тем (вже виправлено).
- Daily reminders/logs: виправлено зламаний текст у форматі `????...: <title>` у сповіщеннях і в "Останніх діях"; додано санітизацію логів при читанні/записі в `localStore`.
- Telegram UI: нумерація карток акаунтів тепер показує глобальний номер із повного списку навіть під фільтрами (з нотатками/хештегами/пошуком), а не `index+1` від видимого піднабору.
- Telegram launch stop: виправлено сценарій "Завершити" під час масового запуску - додано backend cancel-команду (`request_telegram_launch_cancel`) і інтеграцію у фронт; нові інстанси не повинні продовжувати старт після скасування.
- Tauri/Tray: додано `tauri-plugin-single-instance`; повторний запуск із ярлика тепер фокусує існуючий інстанс замість створення другого процесу/другої іконки в треї.
- Telegram launch reliability: реалізовано `health-check + 1 quick retry` після кожного батчу (у т.ч. перший батч і продовження по F6) для профілів, що "відпали" одразу після старту.

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` - проходить.
- `cargo check` - проходить.

### Поточний статус / Ризики
- Quick retry зараз завжди увімкнений (константи в коді); за потреби можна винести в Settings як перемикач.
- Значення "запущено" у тостах після батчу показує фактично живі інстанси після quick retry, тоді як прогрес батчу рахується по оброблених профілях.
## Snapshot (2026-02-29) — responsive polish

### Закрито в цій сесії
- Telegram layout: прибрано макс-ширину/стиснуту праву колонку, тому віджети знову розтягуються на весь екран, але попередні `gap`/spacing збереглись.
- Calendar widget: зроблено компактні кнопки без крапок і щільними падінгами (`text-xs`, `px-2 py-0.5`), плюс дерево дивиться одразу під чолкою без зайвих відступів.
- Window controls: однаковий розмір/сontrast, один strokeWidth, прибране субпіксельне `translate`, стартове вікно `1102x716` відцентровано.

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` — проходить.
## Snapshot (2026-02-27) — i18n/Settings UI polishing

### Закрито в цій сесії
- i18n: доведено мультимовність інтерфейсу (uk/en/ru) у ключових модулях Telegram/модалках/віджетах, виправлено залишки хардкоду.
- Encoding fix: виправлено зламані рядки `����...` у модальних вікнах (`AuthOnboardingModal`, `CustomLinkModal`, `ProjectModal`) та календарних віджетах (`glass-calendar`, `visualize-booking`) з переведенням у UTF-8.
- Daily Tasks: заголовок віджета зафіксовано як `Daily` (без перекладу за вимогою).
- Telegram: локалізовано залишок бейджа `link` і alt для іконки blocked-стану.
- Settings/UI: селект мови переведено з нативного `<select>` на дизайн-системний `Select`; виправлено стилізацію дропдауна та вирівнювання стрілки.
- Settings/UI: картку мови перенесено вниз сторінки налаштувань; прибрано підписи під селектом мови; заголовок змінено на `Мова`.
- Settings/UI: прибрано допоміжні описи для полів Telegram/Chrome (про потоки та шляхи до папок).
- Settings/UI: прибрано підзаголовок сторінки `Керування параметрами системи`.

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` — проходить.

### Поточний статус / Ризики
- Основні видимі `����...` у використаних компонентах виправлені.
- Потенційно можуть лишатися англомовні `sr-only` підписи у базових `ui/*` компонентах (accessibility), якщо потрібна повна локалізація цього шару.
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

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` — проходить.

## Snapshot (2026-02-27)

### Закрито в цій сесії
- Telegram: стабілізовано закриття батчів — додано ретраї закриття по папках та визначення реальних PID за `TG N` (нова команда `get_telegram_pids_for_accounts`), F6 тепер закриває надійніше.
- Telegram: прибрано логування в “Останні дії” для відкриття/закриття акаунта і повідомлення “Продовжено запуск…”. Повідомлення про кастомне посилання змінено на “Запущено своє посилання <name>”, завершення — “Завершено <name>”.
- Daily Tasks: при позначенні задачі як виконаної очищаються нагадування; в модальному “Заплановано” показуються лише майбутні ненагадані записи.
- Telegram: toasts для нотаток/назви акаунта показують номер картки (index+1), а не внутрішній ID; логування цих дій у “Останні дії” прибрано.
- Themes: інтегровано tsParticles (Winter/Spring/Summer/Autumn), увімкнено перемикачі сезонів у налаштуваннях, виправлено ініціалізацію через `initParticlesEngine` та фіксований контейнер.
- Dev: після оновлення Node до 25.6.1 перебудовано `better-sqlite3`; у `server/index.ts` прибрано `reusePort` і змінено host на `127.0.0.1` для Windows.

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
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

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
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

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
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

- Telegram / Mass launch UI reset: додано авто-скидання віджета масового запуску після ручного закриття Telegram-вікон поза додатком (орієнтація на реальні запущені процеси, а не лише локальний React-стан).
- Telegram / Mass launch UI reset: під час активних batch-маркерів додано короткий polling (`~1.5s`) з перевіркою running-процесів; якщо процесів не залишилось — повний reset launch-сесії + `localStore.clearTelegramLaunchState()`.
- Telegram / Finish flow hardening: підтверджено стабільну роботу `Finish` після race-condition правок (cancel/stop guard-и, fallback close, stop barrier), повторний старт батчу після stop більше не має відбуватись.
### Перевірки
- `npm run check` — проходить.






