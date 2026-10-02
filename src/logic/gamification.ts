import { ph } from '../services/i18nService';
import {
  UserGamificationState,
  UserLevelInfo,
  UserCheckInRecord,
  AchievementItem,
} from '../types';

export const LEVELS_CONFIG: UserLevelInfo[] = [
  {
    level: 1,
    title: ph('Новачок у шинку'),
    badgeEmoji: '🍺',
    minXp: 0,
    maxXp: 100,
    perk: ph('Відкриті всі столики та чати'),
  },
  {
    level: 2,
    title: ph('Любитель пінти'),
    badgeEmoji: '🍻',
    minXp: 100,
    maxXp: 300,
    perk: ph('Швидкий клич на вечір у радіусі 3 км'),
  },
  {
    level: 3,
    title: ph('Завсідник барів'),
    badgeEmoji: '🍸',
    minXp: 300,
    maxXp: 600,
    perk: ph('Бейдж надійного партнера для компанії'),
  },
  {
    level: 4,
    title: ph('Крафтовий сомельє'),
    badgeEmoji: '🍷',
    minXp: 600,
    maxXp: 1000,
    perk: ph('Пріоритетна підсадка до столів'),
  },
  {
    level: 5,
    title: ph('Легенда барної стійки'),
    badgeEmoji: '👑',
    minXp: 1000,
    maxXp: 1500,
    perk: ph('Золота аура навколо аватарки'),
  },
  {
    level: 6,
    title: ph('Гросмейстер тостів'),
    badgeEmoji: '🏆',
    minXp: 1500,
    maxXp: 3000,
    perk: ph('VIP статус амбасадора та першовідкривача'),
  },
];

export const ALL_ACHIEVEMENTS: Omit<AchievementItem, 'isUnlocked' | 'unlockedAt'>[] = [
  {
    id: 'first_checkin',
    title: ph('Перший келих'),
    description: ph('Зробіть свій перший успішний чекін у барі'),
    icon: '🍺',
    xpReward: 50,
  },
  {
    id: 'podil_king',
    title: ph('Король Подолу'),
    description: ph('Успішний чекін або зустріч у закладі на Подолі'),
    icon: '👑',
    xpReward: 50,
  },
  {
    id: 'party_soul',
    title: ph('Душа компанії'),
    description: ph('Візьміть участь у 3 спільних столиках чи кличах'),
    icon: '👥',
    xpReward: 100,
  },
  {
    id: 'explorer_3',
    title: ph('Барний гід'),
    description: ph('Відвідайте щонайменше 3 різні бари'),
    icon: '🧭',
    xpReward: 100,
  },
  {
    id: 'night_marathon',
    title: ph('Барний марафон'),
    description: ph('Здійсніть 5 успішних зустрічей у барах'),
    icon: '⚡',
    xpReward: 150,
  },
  {
    id: 'toast_master',
    title: ph('Майстер тостів'),
    description: ph('Підніміть келихи (тост чи привітання «Будьмо!»)'),
    icon: '🥂',
    xpReward: 50,
  },
];

export const EMPTY_GAMIFICATION_STATE: UserGamificationState = {
  xp: 0,
  level: 1,
  totalMeetups: 0,
  checkIns: [],
  achievements: [],
};

export type CheckInType = 'bar_visit' | 'hangout_join' | 'cheers_toast' | 'meetup_proposal';

export interface CheckInInput {
  barName: string;
  area?: string;
  note?: string;
  buddyName?: string;
  type?: CheckInType;
}

export interface LevelProgress {
  currentLevel: UserLevelInfo;
  nextLevel: UserLevelInfo | null;
  progressPercent: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  totalXpForNextLevel: number;
}

/** Calculate level info from total XP */
export function getLevelInfo(xp: number): LevelProgress {
  let current = LEVELS_CONFIG[0];
  for (let i = LEVELS_CONFIG.length - 1; i >= 0; i--) {
    if (xp >= LEVELS_CONFIG[i].minXp) {
      current = LEVELS_CONFIG[i];
      break;
    }
  }

  const next = LEVELS_CONFIG.find((lvl) => lvl.level === current.level + 1) ?? null;

  if (!next) {
    return {
      currentLevel: current,
      nextLevel: null,
      progressPercent: 100,
      xpInCurrentLevel: xp - current.minXp,
      xpNeededForNextLevel: 0,
      totalXpForNextLevel: current.maxXp,
    };
  }

  const span = next.minXp - current.minXp;
  const gained = Math.max(0, xp - current.minXp);
  return {
    currentLevel: current,
    nextLevel: next,
    progressPercent: Math.min(100, Math.max(0, Math.round((gained / span) * 100))),
    xpInCurrentLevel: gained,
    xpNeededForNextLevel: Math.max(0, next.minXp - xp),
    totalXpForNextLevel: next.minXp,
  };
}

export interface CheckInResult {
  updatedState: UserGamificationState;
  earnedXp: number;
  didLevelUp: boolean;
  prevLevel: UserLevelInfo;
  newLevel: UserLevelInfo;
  unlockedAchievements: AchievementItem[];
}

/** Pure: applies a bar check-in / meetup to a gamification state and reports what changed */
export function applyCheckIn(current: UserGamificationState, data: CheckInInput, now = Date.now()): CheckInResult {
  const prevLevelInfo = getLevelInfo(current.xp);

  // XP: base 100 for bar visit, 80 for hangout, 90 for proposal, 30 for toast
  let earnedXp = 100;
  if (data.type === 'hangout_join') earnedXp = 80;
  if (data.type === 'cheers_toast') earnedXp = 30;
  if (data.type === 'meetup_proposal') earnedXp = 90;

  // First time visiting this bar bonus
  const alreadyVisited = current.checkIns.some((c) => c.barName.toLowerCase() === data.barName.toLowerCase());
  if (!alreadyVisited && data.type === 'bar_visit') {
    earnedXp += 25;
  }

  const newRecord: UserCheckInRecord = {
    id: `checkin-${now}`,
    barName: data.barName,
    area: data.area || ph('Київ'),
    timestamp: ph('Щойно'),
    pointsEarned: earnedXp,
    note: data.note || ph('Успішна дружня зустріч у барі 🍻'),
    buddyName: data.buddyName,
    type: data.type || 'bar_visit',
  };

  const checkIns = [newRecord, ...current.checkIns];
  const totalMeetups = (current.totalMeetups || 0) + 1;
  let totalXp = current.xp + earnedXp;

  const unlocked = new Set(current.achievements || []);
  const unlockedAchievements: AchievementItem[] = [];

  ALL_ACHIEVEMENTS.forEach((ach) => {
    if (unlocked.has(ach.id)) return;

    let conditionMet = false;
    if (ach.id === 'first_checkin' && totalMeetups >= 1) conditionMet = true;
    if (
      ach.id === 'podil_king' &&
      (data.area?.toLowerCase().includes('поділ') || // i18n-ignore: matches Ukrainian area names, not UI text
        data.barName.toLowerCase().includes('squat') ||
        data.barName.toLowerCase().includes('win'))
    ) {
      conditionMet = true;
    }
    if (ach.id === 'party_soul' && checkIns.filter((c) => c.type === 'hangout_join').length >= 3) conditionMet = true;
    if (ach.id === 'explorer_3' && new Set(checkIns.map((c) => c.barName.toLowerCase())).size >= 3) conditionMet = true;
    if (ach.id === 'night_marathon' && totalMeetups >= 5) conditionMet = true;
    if (ach.id === 'toast_master' && data.type === 'cheers_toast') conditionMet = true;

    if (conditionMet) {
      unlocked.add(ach.id);
      totalXp += ach.xpReward;
      unlockedAchievements.push({ ...ach, isUnlocked: true, unlockedAt: ph('Щойно') });
    }
  });

  const newLevelInfo = getLevelInfo(totalXp);
  return {
    updatedState: {
      xp: totalXp,
      level: newLevelInfo.currentLevel.level,
      totalMeetups,
      checkIns,
      achievements: Array.from(unlocked),
    },
    earnedXp,
    didLevelUp: newLevelInfo.currentLevel.level > prevLevelInfo.currentLevel.level,
    prevLevel: prevLevelInfo.currentLevel,
    newLevel: newLevelInfo.currentLevel,
    unlockedAchievements,
  };
}

/** Pure: adds bonus XP (friend added, meetup created, ...) */
export function applyBonusXp(
  current: UserGamificationState,
  xpAmount: number
): { updatedState: UserGamificationState; didLevelUp: boolean } {
  const prev = getLevelInfo(current.xp);
  const xp = current.xp + xpAmount;
  const next = getLevelInfo(xp);
  return {
    updatedState: { ...current, xp, level: next.currentLevel.level },
    didLevelUp: next.currentLevel.level > prev.currentLevel.level,
  };
}

/** Full list of achievements with unlock status */
export function getAchievementsWithStatus(achievementsUnlocked: string[] = []): AchievementItem[] {
  const unlockedSet = new Set(achievementsUnlocked);
  return ALL_ACHIEVEMENTS.map((ach) => ({
    ...ach,
    isUnlocked: unlockedSet.has(ach.id),
    unlockedAt: unlockedSet.has(ach.id) ? ph('Отримано') : undefined,
  }));
}
