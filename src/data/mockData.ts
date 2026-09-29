import { BuddyProfile, ChatThread, DrinkType, HangoutAlert, MoodType, PaymentEtiquette } from '../types';

export const DRINK_METADATA: Record<DrinkType, { label: string; icon: string; bg: string; color: string }> = {
  craft: { label: 'Крафтове пиво', icon: '🍺', bg: 'bg-amber-950/60 border-amber-800/40', color: 'text-amber-400' },
  beer: { label: 'Лагер / Ель', icon: '🍻', bg: 'bg-amber-950/60 border-amber-800/40', color: 'text-amber-300' },
  wine: { label: 'Сухе вино', icon: '🍷', bg: 'bg-rose-950/60 border-rose-800/40', color: 'text-rose-400' },
  cocktail: { label: 'Коктейлі', icon: '🍸', bg: 'bg-emerald-950/60 border-emerald-800/40', color: 'text-emerald-400' },
  whiskey: { label: 'Віскі / Бурбон', icon: '🥃', bg: 'bg-orange-950/60 border-orange-800/40', color: 'text-orange-400' },
  cider: { label: 'Яблучний сидр', icon: '🍏', bg: 'bg-lime-950/60 border-lime-800/40', color: 'text-lime-400' },
  shots: { label: 'Шоти / Настоянки', icon: '🍶', bg: 'bg-violet-950/60 border-violet-800/40', color: 'text-violet-400' },
  non_alcoholic: { label: 'Безалкогольне / Чай', icon: '☕', bg: 'bg-cyan-950/60 border-cyan-800/40', color: 'text-cyan-400' },
};

export const MOOD_METADATA: Record<MoodType, { label: string; emoji: string }> = {
  chill_talk: { label: 'Поговорити за життя', emoji: '💬' },
  coding_it: { label: 'Обговорити IT та код', emoji: '💻' },
  board_games: { label: 'Настілки під келих', emoji: '🎲' },
  bar_crawl: { label: 'Бар-хопінг по закладах', emoji: '🚶‍♂️' },
  sports_football: { label: 'Спорт / Футбол на великому екрані', emoji: '⚽' },
  deep_philosophy: { label: 'Глибока філософія', emoji: '🌌' },
  live_music: { label: 'Жива музика / Джаз', emoji: '🎷' },
};

export const PAYMENT_METADATA: Record<PaymentEtiquette, { label: string; badge: string }> = {
  split_50_50: { label: 'Рахунок навпіл (50/50)', badge: '⚖️ 50/50' },
  each_for_themselves: { label: 'Кожен сам за себе', badge: '🧾 Роздільно' },
  i_treat: { label: 'Я пригощаю сьогодні', badge: '🎁 Пригощаю' },
  rounds: { label: 'По черзі беремо раунди', badge: '🔄 Раундами' },
};

export interface InterestCategory {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
}

export const POPULAR_INTERESTS: InterestCategory[] = [
  { id: 'it', label: 'IT & Код', emoji: '💻', keywords: ['React Native & Expo', 'IT', 'код', 'AI'] },
  { id: 'board_games', label: 'Настілки & Шахи', emoji: '🎲', keywords: ['Настільні ігри', 'Шахи'] },
  { id: 'travel', label: 'Подорожі', emoji: '🏔️', keywords: ['Подорожі Карпатами', 'Мандрівки'] },
  { id: 'sports', label: 'Футбол & Спорт', emoji: '⚽', keywords: ['Ліга чемпіонів', 'Спорт', 'Футбол', 'Автомобілі'] },
  { id: 'craft_beer', label: 'Крафт & Пиво', emoji: '🍺', keywords: ['Крафтове пивоваріння', 'DIPA', 'пиво'] },
  { id: 'wine_culture', label: 'Вина & Енологія', emoji: '🍷', keywords: ['Французькі вина', 'Вино', 'Pinot'] },
  { id: 'cocktails', label: 'Міксологія & Бари', emoji: '🍸', keywords: ['Міксологія', 'спікізі', 'Негроні'] },
  { id: 'cinema_books', label: 'Кіно & Книги', emoji: '🎬', keywords: ['Кіно 90-х', 'Книги', 'Світова історія'] },
  { id: 'design_photo', label: 'Дизайн & Фото', emoji: '📸', keywords: ['Архітектура Києва', 'Плівкове фото', 'дизайн'] },
  { id: 'humor_standup', label: 'Стендап & Комікси', emoji: '🎙️', keywords: ['Стендап', 'Комікси', 'Котики'] },
  { id: 'psychology', label: 'Психологія', emoji: '🧠', keywords: ['Психологія', 'філософія'] },
];

export const INITIAL_BUDDIES: BuddyProfile[] = [];

export const INITIAL_HANGOUTS: HangoutAlert[] = [];

export const INITIAL_CHATS: ChatThread[] = [];

export { 
  TOASTS_PRESETS, 
  ALL_TOASTS, 
  TOAST_CATEGORIES, 
  getRandomToast 
} from './toastsData';
export type { ToastItem, ToastCategoryMeta } from './toastsData';
