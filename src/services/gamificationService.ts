import { 
  UserGamificationState, 
  UserLevelInfo, 
  UserCheckInRecord, 
  AchievementItem 
} from '../types';
import { sounds } from './soundService';
import { firestoreSyncService } from './firestoreSyncService';

export const LEVELS_CONFIG: UserLevelInfo[] = [
  {
    level: 1,
    title: 'Новачок у шинку',
    badgeEmoji: '🍺',
    minXp: 0,
    maxXp: 100,
    perk: 'Відкриті всі столики та чати',
  },
  {
    level: 2,
    title: 'Любитель пінти',
    badgeEmoji: '🍻',
    minXp: 100,
    maxXp: 300,
    perk: 'Швидкий клич на вечір у радіусі 3 км',
  },
  {
    level: 3,
    title: 'Завсідник барів',
    badgeEmoji: '🍸',
    minXp: 300,
    maxXp: 600,
    perk: 'Бейдж надійного партнера для компанії',
  },
  {
    level: 4,
    title: 'Крафтовий сомельє',
    badgeEmoji: '🍷',
    minXp: 600,
    maxXp: 1000,
    perk: 'Пріоритетна підсадка до столів',
  },
  {
    level: 5,
    title: 'Легенда барної стійки',
    badgeEmoji: '👑',
    minXp: 1000,
    maxXp: 1500,
    perk: 'Золота аура навколо аватарки',
  },
  {
    level: 6,
    title: 'Гросмейстер тостів',
    badgeEmoji: '🏆',
    minXp: 1500,
    maxXp: 3000,
    perk: 'VIP статус амбасадора та першовідкривача',
  },
];

export const ALL_ACHIEVEMENTS: Omit<AchievementItem, 'isUnlocked' | 'unlockedAt'>[] = [
  {
    id: 'first_checkin',
    title: 'Перший келих',
    description: 'Зробіть свій перший успішний чекін у барі',
    icon: '🍺',
    xpReward: 50,
  },
  {
    id: 'podil_king',
    title: 'Король Подолу',
    description: 'Успішний чекін або зустріч у закладі на Подолі',
    icon: '👑',
    xpReward: 50,
  },
  {
    id: 'party_soul',
    title: 'Душа компанії',
    description: 'Візьміть участь у 3 спільних столиках чи кличах',
    icon: '👥',
    xpReward: 100,
  },
  {
    id: 'explorer_3',
    title: 'Барний гід',
    description: 'Відвідайте щонайменше 3 різні бари',
    icon: '🧭',
    xpReward: 100,
  },
  {
    id: 'night_marathon',
    title: 'Барний марафон',
    description: 'Здійсніть 5 успішних зустрічей у барах',
    icon: '⚡',
    xpReward: 150,
  },
  {
    id: 'toast_master',
    title: 'Майстер тостів',
    description: 'Підніміть келихи (тост чи привітання «Будьмо!»)',
    icon: '🥂',
    xpReward: 50,
  },
];

const STORAGE_PREFIX = 'budmo_gamification_';

// Initial default seed for realism (user already has 1-2 initial meetups on join)
const DEFAULT_INITIAL_STATE: UserGamificationState = {
  xp: 180,
  level: 2,
  totalMeetups: 2,
  checkIns: [
    {
      id: 'chk-init-1',
      barName: 'Squat 17b',
      area: 'Київ, Центр',
      timestamp: '2 дні тому',
      pointsEarned: 100,
      note: 'Крафтовий сидр у дворику, обговорили IT та мобільну розробку',
      buddyName: 'Богдан',
      type: 'bar_visit',
    },
    {
      id: 'chk-init-2',
      barName: 'Win Bar',
      area: 'Київ, Поділ',
      timestamp: 'Вчора',
      pointsEarned: 80,
      note: 'Келих Піно Гріджо та гарна розмова про подорожі',
      buddyName: 'Марія',
      type: 'hangout_join',
    },
  ],
  achievements: ['first_checkin', 'podil_king'],
};

export class GamificationService {
  /**
   * Calculate level info from total XP
   */
  getLevelInfo(xp: number): {
    currentLevel: UserLevelInfo;
    nextLevel: UserLevelInfo | null;
    progressPercent: number;
    xpInCurrentLevel: number;
    xpNeededForNextLevel: number;
    totalXpForNextLevel: number;
  } {
    let current = LEVELS_CONFIG[0];
    for (let i = LEVELS_CONFIG.length - 1; i >= 0; i--) {
      if (xp >= LEVELS_CONFIG[i].minXp) {
        current = LEVELS_CONFIG[i];
        break;
      }
    }

    const nextIndex = LEVELS_CONFIG.findIndex((lvl) => lvl.level === current.level + 1);
    const next = nextIndex !== -1 ? LEVELS_CONFIG[nextIndex] : null;

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
    const progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));
    const xpNeededForNextLevel = Math.max(0, next.minXp - xp);

    return {
      currentLevel: current,
      nextLevel: next,
      progressPercent,
      xpInCurrentLevel: gained,
      xpNeededForNextLevel,
      totalXpForNextLevel: next.minXp,
    };
  }

  /**
   * Load gamification state from LocalStorage or fallback to seed
   */
  loadGamificationState(userId: string = 'me'): UserGamificationState {
    if (typeof window === 'undefined') return DEFAULT_INITIAL_STATE;
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (stored) {
        const parsed: UserGamificationState = JSON.parse(stored);
        // Ensure level is synced with current XP calculation
        const { currentLevel } = this.getLevelInfo(parsed.xp);
        parsed.level = currentLevel.level;
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse gamification state:', e);
    }
    return DEFAULT_INITIAL_STATE;
  }

  /**
   * Save gamification state
   */
  saveGamificationState(userId: string = 'me', state: UserGamificationState): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(state));
      // Background sync to Cloud Firestore if connected
      firestoreSyncService.syncGamification(userId, state).catch(() => {});
    } catch (e) {
      console.warn('Failed to save gamification state:', e);
    }
  }

  /**
   * Record a new successful meetup / check-in in a bar
   */
  recordCheckIn(
    userId: string = 'me',
    data: {
      barName: string;
      area?: string;
      note?: string;
      buddyName?: string;
      type?: 'bar_visit' | 'hangout_join' | 'cheers_toast' | 'meetup_proposal';
    }
  ): {
    updatedState: UserGamificationState;
    earnedXp: number;
    didLevelUp: boolean;
    prevLevel: UserLevelInfo;
    newLevel: UserLevelInfo;
    unlockedAchievements: AchievementItem[];
  } {
    const currentState = this.loadGamificationState(userId);
    const prevLevelInfo = this.getLevelInfo(currentState.xp);

    // XP calculation: base 100 for bar visit, 80 for hangout, 30 for toast
    let earnedXp = 100;
    if (data.type === 'hangout_join') earnedXp = 80;
    if (data.type === 'cheers_toast') earnedXp = 30;
    if (data.type === 'meetup_proposal') earnedXp = 90;

    // First time visiting this bar bonus
    const alreadyVisited = currentState.checkIns.some(
      (c) => c.barName.toLowerCase() === data.barName.toLowerCase()
    );
    if (!alreadyVisited && data.type === 'bar_visit') {
      earnedXp += 25; // Explorer bonus
    }

    const newRecord: UserCheckInRecord = {
      id: `checkin-${Date.now()}`,
      barName: data.barName,
      area: data.area || 'Київ',
      timestamp: 'Щойно',
      pointsEarned: earnedXp,
      note: data.note || 'Успішна дружня зустріч у барі 🍻',
      buddyName: data.buddyName,
      type: data.type || 'bar_visit',
    };

    const updatedCheckIns = [newRecord, ...currentState.checkIns];
    const updatedTotalMeetups = (currentState.totalMeetups || 0) + 1;
    let newTotalXp = currentState.xp + earnedXp;

    // Check newly unlocked achievements
    const newlyUnlocked: AchievementItem[] = [];
    const currentAchievements = new Set(currentState.achievements || []);

    ALL_ACHIEVEMENTS.forEach((ach) => {
      if (!currentAchievements.has(ach.id)) {
        let conditionMet = false;
        if (ach.id === 'first_checkin' && updatedTotalMeetups >= 1) conditionMet = true;
        if (ach.id === 'podil_king' && (data.area?.toLowerCase().includes('поділ') || data.barName.toLowerCase().includes('squat') || data.barName.toLowerCase().includes('win'))) conditionMet = true;
        if (ach.id === 'party_soul' && updatedCheckIns.filter((c) => c.type === 'hangout_join').length >= 3) conditionMet = true;
        if (ach.id === 'explorer_3') {
          const uniqueBars = new Set(updatedCheckIns.map((c) => c.barName.toLowerCase()));
          if (uniqueBars.size >= 3) conditionMet = true;
        }
        if (ach.id === 'night_marathon' && updatedTotalMeetups >= 5) conditionMet = true;
        if (ach.id === 'toast_master' && data.type === 'cheers_toast') conditionMet = true;

        if (conditionMet) {
          currentAchievements.add(ach.id);
          newTotalXp += ach.xpReward; // Bonus achievement points!
          newlyUnlocked.push({
            ...ach,
            isUnlocked: true,
            unlockedAt: 'Щойно',
          });
        }
      }
    });

    const newLevelInfo = this.getLevelInfo(newTotalXp);
    const didLevelUp = newLevelInfo.currentLevel.level > prevLevelInfo.currentLevel.level;

    const updatedState: UserGamificationState = {
      xp: newTotalXp,
      level: newLevelInfo.currentLevel.level,
      totalMeetups: updatedTotalMeetups,
      checkIns: updatedCheckIns,
      achievements: Array.from(currentAchievements),
    };

    this.saveGamificationState(userId, updatedState);

    // Trigger appropriate audio feedback
    if (didLevelUp) {
      sounds.playMatchCheer();
    } else {
      sounds.playClink();
    }

    return {
      updatedState,
      earnedXp,
      didLevelUp,
      prevLevel: prevLevelInfo.currentLevel,
      newLevel: newLevelInfo.currentLevel,
      unlockedAchievements: newlyUnlocked,
    };
  }

  /**
   * Add bonus XP (e.g. for adding a friend or community action)
   */
  addBonusXp(userId: string = 'me', xpAmount: number, _reason?: string): {
    updatedState: UserGamificationState;
    didLevelUp: boolean;
  } {
    const currentState = this.loadGamificationState(userId);
    const prevLevelInfo = this.getLevelInfo(currentState.xp);
    const newTotalXp = currentState.xp + xpAmount;
    const newLevelInfo = this.getLevelInfo(newTotalXp);
    const didLevelUp = newLevelInfo.currentLevel.level > prevLevelInfo.currentLevel.level;

    const updatedState: UserGamificationState = {
      ...currentState,
      xp: newTotalXp,
      level: newLevelInfo.currentLevel.level,
    };

    this.saveGamificationState(userId, updatedState);

    if (didLevelUp) {
      sounds.playMatchCheer();
    } else {
      sounds.playClink();
    }

    return { updatedState, didLevelUp };
  }

  /**
   * Get full list of achievements with unlock status
   */
  getAchievementsWithStatus(achievementsUnlocked: string[] = []): AchievementItem[] {
    const unlockedSet = new Set(achievementsUnlocked);
    return ALL_ACHIEVEMENTS.map((ach) => ({
      ...ach,
      isUnlocked: unlockedSet.has(ach.id),
      unlockedAt: unlockedSet.has(ach.id) ? 'Отримано' : undefined,
    }));
  }
}

export const gamificationService = new GamificationService();
