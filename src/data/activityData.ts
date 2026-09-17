export interface HourlyActivity {
  hour: string; // e.g. "18:00"
  hourNum: number;
  activeUsers: number; // Кількість активних користувачів
  hangoutsCount: number; // Створених кличів
  matchProbability: number; // Ймовірність знайти пару за 10 хв (%)
  status: 'quiet' | 'rising' | 'prime' | 'late_night';
  statusLabel: string;
}

export interface DailyActivity {
  day: string;
  dayShort: string;
  dayNum: number; // 1 = Пн, 7 = Нд
  activeUsers: number;
  peakWindow: string;
  topVibe: string;
  isWeekend: boolean;
  score: number; // 1-10 rating
}

export interface DrinkPopularityInPeak {
  name: string;
  percent: number;
  color: string;
  emoji: string;
}

export const HOURLY_ACTIVITY_DATA: HourlyActivity[] = [
  { hour: '06:00', hourNum: 6, activeUsers: 18, hangoutsCount: 1, matchProbability: 15, status: 'quiet', statusLabel: 'Тиша перед ранком' },
  { hour: '08:00', hourNum: 8, activeUsers: 35, hangoutsCount: 2, matchProbability: 25, status: 'quiet', statusLabel: 'Ранкова кава' },
  { hour: '10:00', hourNum: 10, activeUsers: 72, hangoutsCount: 4, matchProbability: 38, status: 'quiet', statusLabel: 'Робочий час' },
  { hour: '12:00', hourNum: 12, activeUsers: 140, hangoutsCount: 11, matchProbability: 55, status: 'rising', statusLabel: 'Обідні плани' },
  { hour: '14:00', hourNum: 14, activeUsers: 165, hangoutsCount: 14, matchProbability: 60, status: 'rising', statusLabel: 'Денні переписки' },
  { hour: '16:00', hourNum: 16, activeUsers: 240, hangoutsCount: 22, matchProbability: 72, status: 'rising', statusLabel: 'Кінець робочого дня' },
  { hour: '17:00', hourNum: 17, activeUsers: 340, hangoutsCount: 38, matchProbability: 82, status: 'rising', statusLabel: 'Збори на пиво' },
  { hour: '18:00', hourNum: 18, activeUsers: 490, hangoutsCount: 56, matchProbability: 90, status: 'prime', statusLabel: 'Початок вечірнього піку' },
  { hour: '19:00', hourNum: 19, activeUsers: 640, hangoutsCount: 78, matchProbability: 95, status: 'prime', statusLabel: '🔥 Гарячий час' },
  { hour: '20:00', hourNum: 20, activeUsers: 720, hangoutsCount: 92, matchProbability: 98, status: 'prime', statusLabel: '🔥 МАКСИМУМ ОНЛАЙНУ' },
  { hour: '21:00', hourNum: 21, activeUsers: 710, hangoutsCount: 88, matchProbability: 97, status: 'prime', statusLabel: '🔥 Пік за столиками' },
  { hour: '22:00', hourNum: 22, activeUsers: 590, hangoutsCount: 65, matchProbability: 88, status: 'prime', statusLabel: 'Бар-хопінг & тости' },
  { hour: '23:00', hourNum: 23, activeUsers: 410, hangoutsCount: 40, matchProbability: 76, status: 'late_night', statusLabel: 'Нічні посиденьки' },
  { hour: '00:00', hourNum: 24, activeUsers: 280, hangoutsCount: 24, matchProbability: 62, status: 'late_night', statusLabel: 'Опівнічний келих' },
  { hour: '01:00', hourNum: 1, activeUsers: 170, hangoutsCount: 12, matchProbability: 45, status: 'late_night', statusLabel: 'Останні замовлення' },
  { hour: '03:00', hourNum: 3, activeUsers: 45, hangoutsCount: 3, matchProbability: 20, status: 'quiet', statusLabel: 'Сонний Київ' },
];

export const DAILY_ACTIVITY_DATA: DailyActivity[] = [
  { day: 'Понеділок', dayShort: 'Пн', dayNum: 1, activeUsers: 240, peakWindow: '19:00 – 21:30', topVibe: 'Спокійний келих після роботи', isWeekend: false, score: 5.5 },
  { day: 'Вівторок', dayShort: 'Вт', dayNum: 2, activeUsers: 310, peakWindow: '19:00 – 22:00', topVibe: 'Крафтове пиво & розмови', isWeekend: false, score: 6.2 },
  { day: 'Середа', dayShort: 'Ср', dayNum: 3, activeUsers: 480, peakWindow: '18:30 – 22:30', topVibe: '«Маленька пʼятниця» & сидр', isWeekend: false, score: 7.8 },
  { day: 'Четвер', dayShort: 'Чт', dayNum: 4, activeUsers: 590, peakWindow: '18:00 – 23:00', topVibe: 'IT-нетворкінг & бари Подолу', isWeekend: false, score: 8.5 },
  { day: 'Пʼятниця', dayShort: 'Пт', dayNum: 5, activeUsers: 920, peakWindow: '17:30 – 00:30', topVibe: '🔥 ГОЛОВНИЙ ПІК ТИЖНЯ! Бар-хопінг', isWeekend: false, score: 10.0 },
  { day: 'Субота', dayShort: 'Сб', dayNum: 6, activeUsers: 860, peakWindow: '16:00 – 01:00', topVibe: 'Денні тераси, вино & вечірні тусовки', isWeekend: true, score: 9.6 },
  { day: 'Неділя', dayShort: 'Нд', dayNum: 7, activeUsers: 430, peakWindow: '17:00 – 21:30', topVibe: 'Розслаблений сидр, настілки, релакс', isWeekend: true, score: 6.8 },
];

export const DRINKS_PEAK_DISTRIBUTION: DrinkPopularityInPeak[] = [
  { name: 'Крафтове пиво & Сидр', percent: 44, color: '#f59e0b', emoji: '🍻' },
  { name: 'Сухе & Натуральне вино', percent: 26, color: '#ec4899', emoji: '🍷' },
  { name: 'Авторські коктейлі', percent: 18, color: '#8b5cf6', emoji: '🍸' },
  { name: 'Безалкогольне / Кава', percent: 12, color: '#10b981', emoji: '☕' },
];

export interface BestTimeRecommendation {
  badge: string;
  bestHours: string;
  bestDays: string;
  fastestMatch: string;
  currentActivityStatus: string;
  recommendationTip: string;
}

export function getCurrentActivityInsights(currentHour: number = new Date().getHours()): BestTimeRecommendation {
  const isPrime = currentHour >= 18 && currentHour <= 23;
  const isRising = (currentHour >= 12 && currentHour < 18);
  const isLate = currentHour >= 0 && currentHour < 3;

  let currentActivityStatus = '🟢 Помірний трафік';
  let recommendationTip = 'Користувачі починають домовлятися про вечірні плани.';

  if (isPrime) {
    currentActivityStatus = '🔥 ЗАРАЗ ПІКОВИЙ ЧАС (+95% пошуків)';
    recommendationTip = 'Ідеальний момент! За столиками та на радарі максимальна кількість людей. Відповідь на клич за 2-5 хвилин.';
  } else if (isRising) {
    currentActivityStatus = '⚡ Активність зростає';
    recommendationTip = 'Люди планують зустрічі після роботи. Киньте клич заздалегідь, щоб забронювати столик.';
  } else if (isLate) {
    currentActivityStatus = '🌙 Нічний вайб';
    recommendationTip = 'Зараз активні нічні заклади, бар-хопінг та караоке.';
  } else {
    currentActivityStatus = '💤 Спокійний час';
    recommendationTip = 'Найкращий час запланувати вечір або переглянути профілі співрозмовників.';
  }

  return {
    badge: isPrime ? '🔥 Пікові години зараз' : '📊 Огляд активності',
    bestHours: '19:00 – 22:30',
    bestDays: 'Пʼятниця та Субота',
    fastestMatch: '3–6 хвилин (у піковий час)',
    currentActivityStatus,
    recommendationTip,
  };
}
