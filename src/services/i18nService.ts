import { AppLanguage, LanguageMeta, GeoBlockInfo } from '../types';

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  {
    code: 'uk',
    name: 'Ukrainian',
    nativeName: 'Українська',
    flag: '🇺🇦',
    regionHint: 'Україна (UA)',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    regionHint: 'International',
  },
  {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    flag: '🇵🇱',
    regionHint: 'Polska (PL)',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    regionHint: 'Deutschland (DE)',
  },
];

const LANG_STORAGE_KEY = 'budmo_app_lang';
const RU_BLOCK_TEST_KEY = 'budmo_simulate_ru_block';

// All official Russian timezones according to IANA database
export const RUSSIAN_TIMEZONES = [
  'Europe/Moscow',
  'Europe/Samara',
  'Europe/Volgograd',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Europe/Astrakhan',
  'Europe/Kirov',
  'Europe/Kaliningrad',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Novosibirsk',
  'Asia/Novokuznetsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Chita',
  'Asia/Yakutsk',
  'Asia/Khandyga',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Asia/Magadan',
  'Asia/Sakhalin',
  'Asia/Srednekolymsk',
  'Asia/Kamchatka',
  'Asia/Anadyr',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'W-SU',
];

/**
 * Checks whether user coordinates or environment indicate the Russian Federation.
 * The application enforces a strict, permanent block on Russian territory.
 */
export function checkRussianTerritoryRestriction(coords?: { lat: number; lng: number } | null): GeoBlockInfo {
  // Check if simulated block is active for testing
  const simulated = typeof window !== 'undefined' && localStorage.getItem(RU_BLOCK_TEST_KEY) === 'true';
  if (simulated) {
    return {
      isBlocked: true,
      reason: 'СИМУЛЯЦІЯ: Тестове виявлення локації на території РФ (Тестовий режим)',
      detectedCountry: 'Російська Федерація (RU)',
      detectedTimezone: 'Europe/Moscow',
      isSimulated: true,
    };
  }

  let userTz = '';
  try {
    userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // ignore
  }

  // 1. Timezone match
  const isRussianTz = RUSSIAN_TIMEZONES.some(
    (tz) => tz.toLowerCase() === userTz.toLowerCase()
  );

  if (isRussianTz) {
    return {
      isBlocked: true,
      reason: `Виявлено заборонену географічну зону за таймзоною (${userTz}). Використання застосунку в РФ суворо заборонено.`,
      detectedCountry: 'Російська Федерація (RU)',
      detectedTimezone: userTz,
      isSimulated: false,
    };
  }

  // 2. Coordinate range verification (rough bounding box of Russian territory)
  if (coords) {
    const { lat, lng } = coords;
    // European Russia (north of Caucasus, east of Ukraine/Belarus, west of Urals)
    const isEuropeanRussia = lat >= 51.0 && lat <= 70.0 && lng >= 32.0 && lng <= 60.0;
    // Asian Russia / Siberia / Far East
    const isSiberianRussia = lat >= 42.0 && lat <= 77.0 && lng > 60.0 && lng <= 180.0;
    // Kaliningrad exclave
    const isKaliningrad = lat >= 54.2 && lat <= 55.3 && lng >= 19.8 && lng <= 22.8;

    if (isEuropeanRussia || isSiberianRussia || isKaliningrad) {
      return {
        isBlocked: true,
        reason: `Геолокація вказує на координати (${lat.toFixed(2)}, ${lng.toFixed(2)}) на території РФ. Доступ заблоковано на рівні протоколу безпеки.`,
        detectedCountry: 'Російська Федерація (RU)',
        detectedTimezone: userTz || 'Europe/Moscow',
        isSimulated: false,
      };
    }
  }

  return {
    isBlocked: false,
    reason: '',
  };
}

/**
 * Detects the best matching language based on user's geographic location & browser settings.
 * Russian language is intentionally NOT supported and will be filtered out.
 */
export function detectLanguageFromGeo(coords?: { lat: number; lng: number } | null): {
  lang: AppLanguage;
  source: 'stored' | 'geo' | 'browser' | 'default';
  locationHint: string;
} {
  // 1. Check if user already manually selected a language
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(LANG_STORAGE_KEY) as AppLanguage | null;
    if (stored && ['uk', 'en', 'pl', 'de'].includes(stored)) {
      return {
        lang: stored,
        source: 'stored',
        locationHint: 'Збережено користувачем',
      };
    }
  }

  let userTz = '';
  try {
    userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // ignore
  }

  // 2. Check coordinates if available
  if (coords) {
    const { lat, lng } = coords;
    // Ukraine approximate bounds
    if (lat >= 44.0 && lat <= 52.5 && lng >= 22.0 && lng <= 40.5) {
      return { lang: 'uk', source: 'geo', locationHint: 'Україна (Київ / Гео-координати)' };
    }
    // Poland approximate bounds
    if (lat >= 49.0 && lat <= 55.0 && lng >= 14.0 && lng <= 24.2) {
      return { lang: 'pl', source: 'geo', locationHint: 'Польща (Гео-координати)' };
    }
    // Germany approximate bounds
    if (lat >= 47.2 && lat <= 55.1 && lng >= 5.8 && lng <= 15.1) {
      return { lang: 'de', source: 'geo', locationHint: 'Німеччина (Гео-координати)' };
    }
  }

  // 3. Check timezone
  if (
    userTz.includes('Kyiv') ||
    userTz.includes('Kiev') ||
    userTz.includes('Uzhgorod') ||
    userTz.includes('Zaporozhye')
  ) {
    return { lang: 'uk', source: 'geo', locationHint: 'Україна (Таймзона Київ)' };
  }

  if (userTz.includes('Warsaw')) {
    return { lang: 'pl', source: 'geo', locationHint: 'Польща (Таймзона Варшава)' };
  }

  if (userTz.includes('Berlin') || userTz.includes('Vienna') || userTz.includes('Zurich')) {
    return { lang: 'de', source: 'geo', locationHint: 'Німеччина / DACH (Таймзона Берлін)' };
  }

  // 4. Check navigator language preferences
  if (typeof navigator !== 'undefined') {
    const navLangs = navigator.languages || [navigator.language || ''];
    for (const raw of navLangs) {
      const code = raw.toLowerCase().slice(0, 2);
      if (code === 'uk') return { lang: 'uk', source: 'browser', locationHint: 'Мова браузера (Українська)' };
      if (code === 'pl') return { lang: 'pl', source: 'browser', locationHint: 'Мова браузера (Polski)' };
      if (code === 'de') return { lang: 'de', source: 'browser', locationHint: 'Мова браузера (Deutsch)' };
      if (code === 'en') return { lang: 'en', source: 'browser', locationHint: 'Мова браузера (English)' };
      // Note: 'ru' is explicitly ignored and blocked from setting language to Russian
    }
  }

  // Default domestic fallback
  return { lang: 'uk', source: 'default', locationHint: 'За замовченням (Україна)' };
}

export function saveAppLanguage(lang: AppLanguage): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }
}

export function setSimulateRuBlock(enable: boolean): void {
  if (typeof window !== 'undefined') {
    if (enable) {
      localStorage.setItem(RU_BLOCK_TEST_KEY, 'true');
    } else {
      localStorage.removeItem(RU_BLOCK_TEST_KEY);
    }
  }
}

export function getSimulateRuBlock(): boolean {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(RU_BLOCK_TEST_KEY) === 'true';
  }
  return false;
}

// Translations dictionary
export const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  uk: {
    tab_discover: 'Пошук',
    tab_map: 'Мапа',
    tab_radar: 'Радар',
    tab_hangouts: 'Кличі',
    tab_friends: 'Друзі',
    tab_chats: 'Чати',
    tab_profile: 'Профіль',
    profile_title: 'Мій Профіль',
    profile_saved: 'Збережено!',
    save_changes: 'Зберегти зміни',
    language_title: 'Мова застосунку',
    language_auto_geo: 'Автоматично за гео-локацією',
    language_manual: 'Обрано користувачем',
    language_ru_ban_notice: 'Російська мова суворо виключена з застосунку. Доступ з території РФ повністю заблокований.',
    test_ru_block_btn: 'Перевірити блокування РФ',
    disable_ru_test_btn: 'Вимкнути тест блокування',
    status_tagline: 'Мій статус / Слоган у картці',
    drink_pref: 'Що я п’ю найчастіше:',
    payment_etiquette: 'Мій етикет оплати рахунку:',
    favorite_bars: 'Улюблені заклади (через кому):',
    google_connected: 'Авторизовано через Google',
    google_not_connected: 'Google Вхід не виконано',
    change_google_account: 'Змінити Google акаунт',
    login_form: 'Форма входу',
    logout: 'Вийти',
    rn_code: 'RN Код',
    login_with_google: 'Увійти через Google',
    ru_blocked_title: 'ДОСТУП ЗАБЛОКОВАНО',
    ru_blocked_subtitle: 'Цей застосунок повністю заборонено для використання на території Російської Федерації',
    slava_ukraini: 'Слава Україні! Героям Слава! 🇺🇦',
    battery_saver_title: 'Режим енергозбереження (Battery Saver)',
    battery_saver_desc: 'Знижує частоту опитування GPS-локації та фонових оновлень у реальному часі для економії заряду батареї',
    battery_saver_active: 'Активно',
    battery_saver_disabled: 'Вимкнено',
    analytics_title: 'Google Analytics 4 (GA4)',
    analytics_desc: 'Метрики переглядів екранів, відкриття барів та подій синхронізуються через Google Analytics та Firebase',
    analytics_events_tracked: 'Подій зафіксовано',
    analytics_live_stream: 'Журнал подій Live',
    analytics_test_btn: 'Тестова подія GA4',
    analytics_status_active: 'Підключено',
    hangout_chart_title: 'Аналітика походів (Останні 30 днів)',
    hangout_chart_subtitle: 'Динаміка сходів, чекінів у барах та накопичення досвіду',
    hangout_chart_stat_total: 'Всього зустрічей',
    hangout_chart_stat_active: 'Активних днів',
    hangout_chart_stat_streak: 'Поточна серія',
    hangout_chart_stat_peak: 'Піковий день',
    hangout_chart_hangouts_label: 'Сходки / Зустрічі',
    hangout_chart_xp_label: 'XP Бали',
    hangout_chart_range_30d: '30 днів',
    hangout_chart_range_14d: '14 днів',
    hangout_chart_range_7d: '7 днів',
    hangout_chart_empty: 'За вибраний період ще не було виходів',
    firestore_offline_title: 'Офлайн-режим',
    firestore_offline_desc: "З'єднання з Firestore втрачено • Зміни збережуться локально",
    firestore_offline_retry: 'Повторити',
    firestore_offline_retrying: 'Перевірка...',
    firestore_reconnected: "З'єднання з Firestore відновлено!",
  },
  en: {
    tab_discover: 'Discover',
    tab_map: 'Map',
    tab_radar: 'Radar',
    tab_hangouts: 'Hangouts',
    tab_friends: 'Friends',
    tab_chats: 'Chats',
    tab_profile: 'Profile',
    profile_title: 'My Profile',
    profile_saved: 'Saved!',
    save_changes: 'Save changes',
    language_title: 'App Language',
    language_auto_geo: 'Auto-detected by Geo-location',
    language_manual: 'Manually selected',
    language_ru_ban_notice: 'Russian language is strictly excluded. Access from the Russian Federation is completely blocked.',
    test_ru_block_btn: 'Test RU Geo-Block',
    disable_ru_test_btn: 'Disable RU Block Test',
    status_tagline: 'My Tagline / Status in Card',
    drink_pref: 'What I drink most often:',
    payment_etiquette: 'Bill payment etiquette:',
    favorite_bars: 'Favorite venues (comma separated):',
    google_connected: 'Signed in with Google',
    google_not_connected: 'Google sign-in not completed',
    change_google_account: 'Switch Google Account',
    login_form: 'Login Form',
    logout: 'Log Out',
    rn_code: 'RN Code',
    login_with_google: 'Sign in with Google',
    ru_blocked_title: 'ACCESS PROHIBITED',
    ru_blocked_subtitle: 'This application is completely prohibited and blocked on the territory of the Russian Federation',
    slava_ukraini: 'Glory to Ukraine! Glory to the Heroes! 🇺🇦',
    battery_saver_title: 'Battery Saver Mode',
    battery_saver_desc: 'Reduces location polling frequency and real-time background sync to conserve battery power',
    battery_saver_active: 'Active',
    battery_saver_disabled: 'Off',
    analytics_title: 'Google Analytics 4 (GA4)',
    analytics_desc: 'Screen views, venue discovery, and interactive user flows are tracked via Google Analytics & Firebase',
    analytics_events_tracked: 'Events recorded',
    analytics_live_stream: 'Live Event Log',
    analytics_test_btn: 'GA4 Test Event',
    analytics_status_active: 'Connected',
    hangout_chart_title: 'Hangout Activity (Last 30 Days)',
    hangout_chart_subtitle: 'Trends of meetups, bar visits, and accumulated XP',
    hangout_chart_stat_total: 'Total Hangouts',
    hangout_chart_stat_active: 'Active Days',
    hangout_chart_stat_streak: 'Current Streak',
    hangout_chart_stat_peak: 'Peak Day',
    hangout_chart_hangouts_label: 'Hangouts / Gatherings',
    hangout_chart_xp_label: 'XP Points',
    hangout_chart_range_30d: '30 Days',
    hangout_chart_range_14d: '14 Days',
    hangout_chart_range_7d: '7 Days',
    hangout_chart_empty: 'No hangouts recorded for this period yet',
    firestore_offline_title: 'Offline Mode',
    firestore_offline_desc: 'Connection to Firestore lost • Changes saved to local cache',
    firestore_offline_retry: 'Retry',
    firestore_offline_retrying: 'Checking...',
    firestore_reconnected: 'Connected to Firestore!',
  },
  pl: {
    tab_discover: 'Odkrywaj',
    tab_map: 'Mapa',
    tab_radar: 'Radar',
    tab_hangouts: 'Spotkania',
    tab_friends: 'Znajomi',
    tab_chats: 'Czaty',
    tab_profile: 'Profil',
    profile_title: 'Mój Profil',
    profile_saved: 'Zapisano!',
    save_changes: 'Zapisz zmiany',
    language_title: 'Język aplikacji',
    language_auto_geo: 'Wykryto automatycznie z geolokalizacji',
    language_manual: 'Wybrano ręcznie',
    language_ru_ban_notice: 'Język rosyjski jest całkowicie wykluczony. Dostęp z terytorium Federacji Rosyjskiej jest całkowicie zablokowany.',
    test_ru_block_btn: 'Przetestuj blokadę RU',
    disable_ru_test_btn: 'Wyłącz test blokady RU',
    status_tagline: 'Mój status / Hasło w profilu',
    drink_pref: 'Co piję najczęściej:',
    payment_etiquette: 'Etykieta płacenia rachunku:',
    favorite_bars: 'Ulubione lokale (oddzielone przecinkami):',
    google_connected: 'Zalogowano przez Google',
    google_not_connected: 'Brak logowania Google',
    change_google_account: 'Zmień konto Google',
    login_form: 'Formularz logowania',
    logout: 'Wyloguj',
    rn_code: 'Kod RN',
    login_with_google: 'Zaloguj się z Google',
    ru_blocked_title: 'DOSTĘP ZABLOKOWANY',
    ru_blocked_subtitle: 'Ta aplikacja jest całkowicie zabroniona i zablokowana na terytorium Federacji Rosyjskiej',
    slava_ukraini: 'Chwała Ukrainie! Bohaterom Chwała! 🇺🇦',
    battery_saver_title: 'Tryb oszczędzania baterii',
    battery_saver_desc: 'Zmniejsza częstotliwość odpytywania GPS oraz synchronizacji w czasie rzeczywistym, oszczędzając baterię',
    battery_saver_active: 'Aktywny',
    battery_saver_disabled: 'Wyłączony',
    analytics_title: 'Google Analytics 4 (GA4)',
    analytics_desc: 'Wyświetlenia ekranów, interakcje z lokalami i zdarzenia są monitorowane przez GA4 i Firebase',
    analytics_events_tracked: 'Zarejestrowane zdarzenia',
    analytics_live_stream: 'Dziennik zdarzeń Live',
    analytics_test_btn: 'Testowe zdarzenie GA4',
    analytics_status_active: 'Połączono',
    hangout_chart_title: 'Aktywność wyjść (Ostatnie 30 dni)',
    hangout_chart_subtitle: 'Trendy spotkań, wizyt w barach i zdobytego XP',
    hangout_chart_stat_total: 'Wszystkich wyjść',
    hangout_chart_stat_active: 'Dni aktywne',
    hangout_chart_stat_streak: 'Aktualna seria',
    hangout_chart_stat_peak: 'Dzień szczytowy',
    hangout_chart_hangouts_label: 'Spotkania',
    hangout_chart_xp_label: 'Punkty XP',
    hangout_chart_range_30d: '30 dni',
    hangout_chart_range_14d: '14 dni',
    hangout_chart_range_7d: '7 dni',
    hangout_chart_empty: 'Brak wyjść w wybranym okresie',
    firestore_offline_title: 'Tryb offline',
    firestore_offline_desc: 'Utracono połączenie z Firestore • Zmiany zapisywane lokalnie',
    firestore_offline_retry: 'Ponów',
    firestore_offline_retrying: 'Sprawdzanie...',
    firestore_reconnected: 'Połączono z Firestore!',
  },
  de: {
    tab_discover: 'Entdecken',
    tab_map: 'Karte',
    tab_radar: 'Radar',
    tab_hangouts: 'Treffen',
    tab_friends: 'Freunde',
    tab_chats: 'Chats',
    tab_profile: 'Profil',
    profile_title: 'Mein Profil',
    profile_saved: 'Gespeichert!',
    save_changes: 'Änderungen speichern',
    language_title: 'App-Sprache',
    language_auto_geo: 'Automatisch per Geo-Standort ermittelt',
    language_manual: 'Manuell ausgewählt',
    language_ru_ban_notice: 'Die russische Sprache ist streng ausgeschlossen. Der Zugriff aus der Russischen Föderation ist vollständig gesperrt.',
    test_ru_block_btn: 'RU-Geosperre testen',
    disable_ru_test_btn: 'RU-Sperrtest beenden',
    status_tagline: 'Mein Status / Slogan',
    drink_pref: 'Was ich am liebsten trinke:',
    payment_etiquette: 'Zahlungsetikette:',
    favorite_bars: 'Lieblingsbars (durch Kommas getrennt):',
    google_connected: 'Mit Google angemeldet',
    google_not_connected: 'Google-Login nicht erfolgt',
    change_google_account: 'Google-Konto wechseln',
    login_form: 'Anmeldeformular',
    logout: 'Abmelden',
    rn_code: 'RN Code',
    login_with_google: 'Mit Google anmelden',
    ru_blocked_title: 'ZUGRIFF GESPERRT',
    ru_blocked_subtitle: 'Diese Anwendung ist auf dem Territorium der Russischen Föderation vollständig untersagt und gesperrt',
    slava_ukraini: 'Ruhm der Ukraine! Den Helden Ruhm! 🇺🇦',
    battery_saver_title: 'Batteriesparmodus',
    battery_saver_desc: 'Reduziert die Häufigkeit der Standortabfrage und Echtzeit-Updates zur Verlängerung der Akkulaufzeit',
    battery_saver_active: 'Aktiv',
    battery_saver_disabled: 'Aus',
    analytics_title: 'Google Analytics 4 (GA4)',
    analytics_desc: 'Bildschirmaufrufe, Bar-Entdeckungen und Benutzerinteraktionen werden über GA4 & Firebase getrackt',
    analytics_events_tracked: 'Erfasste Ereignisse',
    analytics_live_stream: 'Live-Ereignisprotokoll',
    analytics_test_btn: 'GA4 Test-Event',
    analytics_status_active: 'Verbunden',
    hangout_chart_title: 'Treffen-Aktivität (Letzte 30 Tage)',
    hangout_chart_subtitle: 'Trends von Treffen, Bar-Check-ins und gesammelter XP',
    hangout_chart_stat_total: 'Treffen gesamt',
    hangout_chart_stat_active: 'Aktive Tage',
    hangout_chart_stat_streak: 'Aktuelle Serie',
    hangout_chart_stat_peak: 'Spitzentag',
    hangout_chart_hangouts_label: 'Treffen',
    hangout_chart_xp_label: 'XP Punkte',
    hangout_chart_range_30d: '30 Tage',
    hangout_chart_range_14d: '14 Tage',
    hangout_chart_range_7d: '7 Tage',
    hangout_chart_empty: 'Noch keine Treffen in diesem Zeitraum erfasst',
    firestore_offline_title: 'Offline-Modus',
    firestore_offline_desc: 'Verbindung zu Firestore verloren • Daten lokal gespeichert',
    firestore_offline_retry: 'Wiederholen',
    firestore_offline_retrying: 'Prüfung...',
    firestore_reconnected: 'Wieder mit Firestore verbunden!',
  },
};

export function t(key: string, lang?: string | AppLanguage): string {
  const safeLang = (lang as AppLanguage) || 'uk';
  return TRANSLATIONS[safeLang]?.[key] || TRANSLATIONS['uk']?.[key] || key;
}
