import { ph } from '../services/i18nService';
import { DrinkType, MoodType, PaymentEtiquette } from '../types';

export const DRINK_METADATA: Record<DrinkType, { label: string; icon: string; color: string }> = {
  craft: { label: ph('Крафтове пиво'), icon: '🍺', color: '#fbbf24' },
  beer: { label: ph('Лагер / Ель'), icon: '🍻', color: '#fcd34d' },
  wine: { label: ph('Сухе вино'), icon: '🍷', color: '#fb7185' },
  cocktail: { label: ph('Коктейлі'), icon: '🍸', color: '#34d399' },
  whiskey: { label: ph('Віскі / Бурбон'), icon: '🥃', color: '#fb923c' },
  cider: { label: ph('Яблучний сидр'), icon: '🍏', color: '#a3e635' },
  shots: { label: ph('Шоти / Настоянки'), icon: '🍶', color: '#a78bfa' },
  non_alcoholic: { label: ph('Безалкогольне / Чай'), icon: '☕', color: '#22d3ee' },
};

export const MOOD_METADATA: Record<MoodType, { label: string; emoji: string }> = {
  not_specified: { label: ph('Не вказано'), emoji: '—' },
  chill_talk: { label: ph('Поговорити за життя'), emoji: '💬' },
  coding_it: { label: ph('Обговорити IT та код'), emoji: '💻' },
  board_games: { label: ph('Настілки під келих'), emoji: '🎲' },
  bar_crawl: { label: ph('Бар-хопінг по закладах'), emoji: '🚶‍♂️' },
  sports_football: { label: ph('Спорт / Футбол на великому екрані'), emoji: '⚽' },
  deep_philosophy: { label: ph('Глибока філософія'), emoji: '🌌' },
  live_music: { label: ph('Жива музика / Джаз'), emoji: '🎷' },
};

export const PAYMENT_METADATA: Record<PaymentEtiquette, { label: string; badge: string }> = {
  not_specified: { label: ph('Не вказано'), badge: '—' },
  split_50_50: { label: ph('Рахунок навпіл (50/50)'), badge: '⚖️ 50/50' },
  each_for_themselves: { label: ph('Кожен сам за себе'), badge: ph('🧾 Роздільно') },
  i_treat: { label: ph('Я пригощаю сьогодні'), badge: ph('🎁 Пригощаю') },
  rounds: { label: ph('По черзі беремо раунди'), badge: ph('🔄 Раундами') },
};

export interface InterestCategory {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
}

export const POPULAR_INTERESTS: InterestCategory[] = [
  { id: 'it', label: 'IT & Код', emoji: '💻', keywords: ['React Native & Expo', 'IT', 'код', 'AI'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'board_games', label: 'Настілки & Шахи', emoji: '🎲', keywords: ['Настільні ігри', 'Шахи'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'travel', label: 'Подорожі', emoji: '🏔️', keywords: ['Подорожі Карпатами', 'Мандрівки'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'sports', label: 'Футбол & Спорт', emoji: '⚽', keywords: ['Ліга чемпіонів', 'Спорт', 'Футбол', 'Автомобілі'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'craft_beer', label: 'Крафт & Пиво', emoji: '🍺', keywords: ['Крафтове пивоваріння', 'DIPA', 'пиво'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'wine_culture', label: 'Вина & Енологія', emoji: '🍷', keywords: ['Французькі вина', 'Вино', 'Pinot'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'cocktails', label: 'Міксологія & Бари', emoji: '🍸', keywords: ['Міксологія', 'спікізі', 'Негроні'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'cinema_books', label: 'Кіно & Книги', emoji: '🎬', keywords: ['Кіно 90-х', 'Книги', 'Світова історія'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'design_photo', label: 'Дизайн & Фото', emoji: '📸', keywords: ['Архітектура Києва', 'Плівкове фото', 'дизайн'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'humor_standup', label: 'Стендап & Комікси', emoji: '🎙️', keywords: ['Стендап', 'Комікси', 'Котики'] }, // i18n-ignore: matched against Ukrainian profile text
  { id: 'psychology', label: 'Психологія', emoji: '🧠', keywords: ['Психологія', 'філософія'] }, // i18n-ignore: matched against Ukrainian profile text
];

export { 
  TOASTS_PRESETS, 
  ALL_TOASTS, 
  TOAST_CATEGORIES, 
  getRandomToast 
} from './toastsData';
export type { ToastItem, ToastCategoryMeta } from './toastsData';
