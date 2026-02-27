import { useCallback, useEffect, useState } from "react";
import { localStore } from "@/lib/localStore";

export type AppLanguage = "uk" | "en" | "ru";

const FALLBACK_LANGUAGE: AppLanguage = "uk";

const translations = {
  uk: {
    "settings.title": "Налаштування",
    "settings.subtitle": "Керування параметрами системи",
    "settings.tab.general": "Налаштування",
    "settings.tab.themes": "Теми",
    "settings.saved.title": "Налаштування збережено",
    "settings.saved.description": "Ваші зміни успішно застосовані.",
    "settings.folder.selected.title": "Папку вибрано",
    "settings.folder.selected.description": "Обрано папку: {path}",
    "settings.folder.error.title": "Помилка вибору папки",
    "settings.folder.error.description": "Не вдалося відкрити діалог вибору папки",
    "settings.language.title": "Мова",
    "settings.language.description": "Виберіть мову застосунку",
    "settings.language.label": "Мова",
    "settings.language.uk": "Українська",
    "settings.language.en": "English",
    "settings.language.ru": "Русский",
    "settings.theme.title": "Ефект",
    "settings.theme.description": "Візуальні ефекти фону",
    "settings.theme.snow": "Сніг",
    "settings.theme.sakura": "Сакура",
    "settings.theme.rain": "Дощ",
    "settings.theme.leaves": "Опале листя",
    "settings.telegram.threads.label": "Кількість потоків",
    "settings.telegram.threads.description": "Вкажіть кількість одночасних потоків для Telegram",
    "settings.telegram.folder.label": "Шлях до папки з акаунтами",
    "settings.telegram.folder.description": "Вкажіть повний шлях до папки з акаунтами Telegram",
    "settings.chrome.threads.label": "Кількість потоків",
    "settings.chrome.threads.description": "Вкажіть кількість одночасних потоків для Chrome",
    "settings.chrome.folder.label": "Шлях до папки з акаунтами",
    "settings.chrome.folder.description": "Вкажіть повний шлях до папки з акаунтами Chrome",
    "common.save": "Зберегти",
    "sidebar.calendar": "Календар",
    "sidebar.settings": "Налаштування",
    "sidebar.guest": "Гість",
    "sidebar.notLoggedIn": "Вхід не виконано",
    "sidebar.profile.title": "Профіль",
    "sidebar.profile.description": "Вхід не обов'язковий для користування застосунком.",
    "sidebar.logout": "Вийти",
    "sidebar.usernameHint": "Юзернейм: 5-32 символи, тільки латиниця, цифри або підкреслення.",
    "sidebar.saveUsername": "Зберегти юзернейм",
    "sidebar.skip": "Пропустити",
    "stats.accounts.title": "Статистика акаунтів",
    "stats.accounts.running": "Запущено",
    "stats.accounts.blocked": "Заблоковано",
    "stats.accounts.noData": "Немає даних для відображення",
    "chrome.title": "В розробці",
    "chrome.description": "Сторінка знаходиться в процесі розробки",
    "notFound.title": "Сторінку не знайдено",
    "notFound.description": "Схоже, ви звернули не туди.",
    "notFound.back": "Повернутися до Telegram",
  },
  en: {
    "settings.title": "Settings",
    "settings.subtitle": "System configuration",
    "settings.tab.general": "Settings",
    "settings.tab.themes": "Themes",
    "settings.saved.title": "Settings saved",
    "settings.saved.description": "Your changes were applied successfully.",
    "settings.folder.selected.title": "Folder selected",
    "settings.folder.selected.description": "Selected folder: {path}",
    "settings.folder.error.title": "Folder selection error",
    "settings.folder.error.description": "Failed to open the folder selection dialog",
    "settings.language.title": "Language",
    "settings.language.description": "Choose the application language",
    "settings.language.label": "Language",
    "settings.language.uk": "Українська",
    "settings.language.en": "English",
    "settings.language.ru": "Русский",
    "settings.theme.title": "Effect",
    "settings.theme.description": "Background visual effects",
    "settings.theme.snow": "Snow",
    "settings.theme.sakura": "Sakura",
    "settings.theme.rain": "Rain",
    "settings.theme.leaves": "Falling leaves",
    "settings.telegram.threads.label": "Threads count",
    "settings.telegram.threads.description": "Set the number of concurrent threads for Telegram",
    "settings.telegram.folder.label": "Accounts folder path",
    "settings.telegram.folder.description": "Set the full path to the Telegram accounts folder",
    "settings.chrome.threads.label": "Threads count",
    "settings.chrome.threads.description": "Set the number of concurrent threads for Chrome",
    "settings.chrome.folder.label": "Accounts folder path",
    "settings.chrome.folder.description": "Set the full path to the Chrome accounts folder",
    "common.save": "Save",
    "sidebar.calendar": "Calendar",
    "sidebar.settings": "Settings",
    "sidebar.guest": "Guest",
    "sidebar.notLoggedIn": "Not signed in",
    "sidebar.profile.title": "Profile",
    "sidebar.profile.description": "Sign-in is optional for using the app.",
    "sidebar.logout": "Log out",
    "sidebar.usernameHint": "Username: 5-32 characters, only latin letters, digits or underscore.",
    "sidebar.saveUsername": "Save username",
    "sidebar.skip": "Skip",
    "stats.accounts.title": "Account statistics",
    "stats.accounts.running": "Running",
    "stats.accounts.blocked": "Blocked",
    "stats.accounts.noData": "No data to display",
    "chrome.title": "In development",
    "chrome.description": "This page is currently under development",
    "notFound.title": "404 Page Not Found",
    "notFound.description": "Looks like you took a wrong turn.",
    "notFound.back": "Return to Telegram",
  },
  ru: {
    "settings.title": "Настройки",
    "settings.subtitle": "Управление параметрами системы",
    "settings.tab.general": "Настройки",
    "settings.tab.themes": "Темы",
    "settings.saved.title": "Настройки сохранены",
    "settings.saved.description": "Ваши изменения успешно применены.",
    "settings.folder.selected.title": "Папка выбрана",
    "settings.folder.selected.description": "Выбрана папка: {path}",
    "settings.folder.error.title": "Ошибка выбора папки",
    "settings.folder.error.description": "Не удалось открыть диалог выбора папки",
    "settings.language.title": "Язык",
    "settings.language.description": "Выберите язык приложения",
    "settings.language.label": "Язык",
    "settings.language.uk": "Українська",
    "settings.language.en": "English",
    "settings.language.ru": "Русский",
    "settings.theme.title": "Эффект",
    "settings.theme.description": "Визуальные фоновые эффекты",
    "settings.theme.snow": "Снег",
    "settings.theme.sakura": "Сакура",
    "settings.theme.rain": "Дождь",
    "settings.theme.leaves": "Опавшие листья",
    "settings.telegram.threads.label": "Количество потоков",
    "settings.telegram.threads.description": "Укажите количество одновременных потоков для Telegram",
    "settings.telegram.folder.label": "Путь к папке аккаунтов",
    "settings.telegram.folder.description": "Укажите полный путь к папке аккаунтов Telegram",
    "settings.chrome.threads.label": "Количество потоков",
    "settings.chrome.threads.description": "Укажите количество одновременных потоков для Chrome",
    "settings.chrome.folder.label": "Путь к папке аккаунтов",
    "settings.chrome.folder.description": "Укажите полный путь к папке аккаунтов Chrome",
    "common.save": "Сохранить",
    "sidebar.calendar": "Календарь",
    "sidebar.settings": "Настройки",
    "sidebar.guest": "Гость",
    "sidebar.notLoggedIn": "Вход не выполнен",
    "sidebar.profile.title": "Профиль",
    "sidebar.profile.description": "Вход не обязателен для использования приложения.",
    "sidebar.logout": "Выйти",
    "sidebar.usernameHint": "Юзернейм: 5-32 символа, только латиница, цифры или подчёркивание.",
    "sidebar.saveUsername": "Сохранить юзернейм",
    "sidebar.skip": "Пропустить",
    "stats.accounts.title": "Статистика аккаунтов",
    "stats.accounts.running": "Запущено",
    "stats.accounts.blocked": "Заблокировано",
    "stats.accounts.noData": "Нет данных для отображения",
    "chrome.title": "В разработке",
    "chrome.description": "Страница находится в процессе разработки",
    "notFound.title": "Страница 404 не найдена",
    "notFound.description": "Похоже, вы свернули не туда.",
    "notFound.back": "Вернуться в Telegram",
  },
} as const;

type TranslationKey = keyof typeof translations.uk;

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === "en" || value === "ru" ? value : FALLBACK_LANGUAGE;
}

export function getCurrentLanguage(): AppLanguage {
  return normalizeLanguage(localStore.getSettings().language);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function translate(language: AppLanguage, key: TranslationKey, vars?: Record<string, string | number>): string {
  const dict = translations[language] ?? translations[FALLBACK_LANGUAGE];
  const template = dict[key] ?? translations[FALLBACK_LANGUAGE][key] ?? String(key);
  return interpolate(template, vars);
}

export function useI18n() {
  const [language, setLanguage] = useState<AppLanguage>(() => getCurrentLanguage());

  useEffect(() => {
    const syncLanguage = () => setLanguage(getCurrentLanguage());
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ language?: unknown }>)?.detail;
      if (detail && "language" in detail) {
        setLanguage(normalizeLanguage(detail.language));
        return;
      }
      syncLanguage();
    };

    window.addEventListener("settingsUpdated", handleSettingsUpdated as EventListener);
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.removeEventListener("settingsUpdated", handleSettingsUpdated as EventListener);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars),
    [language]
  );

  return { language, t };
}
