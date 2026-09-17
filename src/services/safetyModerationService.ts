import { UserReport, BlockedUserRecord, ReportCategory, ReportTargetType, BuddyProfile, HangoutAlert, GroupMeetup } from '../types';
import { sounds } from './soundService';
import { pushNotificationService } from './pushNotificationService';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

const STORAGE_BLOCKED_USERS = 'budmo_blocked_users_v2';
const STORAGE_USER_REPORTS = 'budmo_user_reports_v2';
const STORAGE_REPORT_COUNTS = 'budmo_report_counts_by_user_v2';

export const REPORT_CATEGORIES: {
  id: ReportCategory;
  title: string;
  description: string;
  icon: string;
  severity: 'high' | 'medium' | 'critical';
}[] = [
  {
    id: 'harassment',
    title: 'Домагання чи агресія',
    description: 'Образи, погрози, небажані домагання чи тиск',
    icon: '🛑',
    severity: 'critical',
  },
  {
    id: 'suspicious',
    title: 'Підозрілий акаунт / Шахрайство',
    description: 'Бот, фішинг, вимагання грошей або підробний профіль',
    icon: '🕵️‍♂️',
    severity: 'critical',
  },
  {
    id: 'toxic_behavior',
    title: 'Неадекватна поведінка в закладі',
    description: 'Надмірне сп’яніння, дебош, порушення порядку за столиком',
    icon: '⚠️',
    severity: 'high',
  },
  {
    id: 'inappropriate_content',
    title: 'Неприйнятний контент / Спам',
    description: 'Реклама, спам-кличі, заборонені матеріали',
    icon: '🚫',
    severity: 'medium',
  },
  {
    id: 'underage',
    title: 'Неповнолітні (Порушення 18+)',
    description: 'Особи до 18 років у додатку для зустрічей у барах',
    icon: '🔞',
    severity: 'critical',
  },
  {
    id: 'spam',
    title: 'Фейковий клич або чекін',
    description: 'Людина не з’явилася або створює неправдиві локації',
    icon: '📢',
    severity: 'medium',
  },
  {
    id: 'other',
    title: 'Інша проблема безпеки',
    description: 'Будь-яке інше порушення правил спільноти',
    icon: '🛡️',
    severity: 'medium',
  },
];

export const SOS_SAFETY_TIPS = [
  {
    title: 'Кодова фраза «Запитайте Анжелу» (Ask for Angela)',
    description: 'Підійдіть до бармена або персоналу закладу та запитайте: «Чи тут Анжела?». Персонал навчений непомітно викликати таксі або провести вас у безпечне місце.',
    icon: '🍸',
  },
  {
    title: 'Екстрена допомога в Україні',
    description: 'Єдиний номер екстрених служб: 112. Поліція: 102. Швидка допомога: 103.',
    icon: '🚨',
  },
  {
    title: 'Публічне місце',
    description: 'Ніколи не залишайте заклад наодинці з малознайомою людиною. Зустрічайтеся лише в людних, добре освітлених місцях.',
    icon: '💡',
  },
];

class SafetyModerationService {
  private blockedUsers: BlockedUserRecord[] = [];
  private reports: UserReport[] = [];
  private reportCounts: Record<string, number> = {};
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    if (typeof window === 'undefined') return;

    try {
      const blockedRaw = localStorage.getItem(STORAGE_BLOCKED_USERS);
      if (blockedRaw) {
        this.blockedUsers = JSON.parse(blockedRaw);
      } else {
        // Seed an example blocked test account to demonstrate anti-abuse quarantine
        this.blockedUsers = [];
      }

      const reportsRaw = localStorage.getItem(STORAGE_USER_REPORTS);
      if (reportsRaw) {
        this.reports = JSON.parse(reportsRaw);
      }

      const countsRaw = localStorage.getItem(STORAGE_REPORT_COUNTS);
      if (countsRaw) {
        this.reportCounts = JSON.parse(countsRaw);
      }
    } catch (e) {
      console.warn('Failed to load safety state:', e);
    }
  }

  private saveState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_BLOCKED_USERS, JSON.stringify(this.blockedUsers));
      localStorage.setItem(STORAGE_USER_REPORTS, JSON.stringify(this.reports));
      localStorage.setItem(STORAGE_REPORT_COUNTS, JSON.stringify(this.reportCounts));
    } catch (e) {
      console.warn('Failed to save safety state:', e);
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Safety listener error:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getBlockedUsers(): BlockedUserRecord[] {
    return [...this.blockedUsers];
  }

  public getReports(): UserReport[] {
    return [...this.reports];
  }

  public isUserBlocked(userId: string): boolean {
    if (!userId) return false;
    return this.blockedUsers.some((u) => u.userId === userId);
  }

  /**
   * Block a user directly (from profile, checkin, or chat)
   */
  public blockUser(
    userId: string,
    userName: string,
    userAvatar?: string,
    reason = 'Заблоковано користувачем',
    autoBlocked = false
  ): BlockedUserRecord {
    const existing = this.blockedUsers.find((u) => u.userId === userId);
    if (existing) return existing;

    const record: BlockedUserRecord = {
      userId,
      userName,
      userAvatar,
      blockedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reason,
      autoBlocked,
    };

    this.blockedUsers.unshift(record);
    this.saveState();
    sounds.playTap();

    pushNotificationService.triggerLocalNotification({
      type: 'system',
      title: autoBlocked ? '🛡️ Анти-абуз: акаунт автозаблоковано' : '🚫 Користувача заблоковано',
      body: autoBlocked
        ? `Акаунт ${userName} отримав кілька скарг і був автоматично ізольований для безпеки спільноти.`
        : `Користувача ${userName} заблоковано. Ви більше не бачитимете його кличі, повідомлення та профіль.`,
      actionText: 'Керувати безпекою',
    });

    return record;
  }

  /**
   * Unblock a user
   */
  public unblockUser(userId: string): boolean {
    const idx = this.blockedUsers.findIndex((u) => u.userId === userId);
    if (idx === -1) return false;

    this.blockedUsers.splice(idx, 1);
    this.saveState();
    sounds.playTap();
    return true;
  }

  /**
   * Submit a quick report on profile, hangout alert, checkin, or chat message
   */
  public async submitReport(params: {
    targetId: string;
    targetType: ReportTargetType;
    targetName: string;
    targetAvatar?: string;
    category: ReportCategory;
    comment: string;
    reporterId?: string;
    reporterName?: string;
    shouldBlockUser?: boolean;
  }): Promise<UserReport> {
    const categoryDef = REPORT_CATEGORIES.find((c) => c.id === params.category);
    const categoryTitle = categoryDef ? categoryDef.title : 'Скарга на контент';

    const newReport: UserReport = {
      id: `rep-${Date.now()}`,
      reporterId: params.reporterId || 'me',
      reporterName: params.reporterName || 'Ви',
      targetId: params.targetId,
      targetType: params.targetType,
      targetName: params.targetName,
      targetAvatar: params.targetAvatar,
      category: params.category,
      categoryTitle,
      comment: params.comment.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'pending',
    };

    this.reports.unshift(newReport);

    // Update report count for auto-blocking logic
    const currentCount = (this.reportCounts[params.targetId] || 0) + 1;
    this.reportCounts[params.targetId] = currentCount;

    // Automatic moderation threshold:
    // If user has >= 2 reports or severe category ('harassment' / 'underage' / 'suspicious'),
    // automatically block the suspicious account!
    const isCritical = categoryDef?.severity === 'critical';
    const reachedThreshold = currentCount >= 2;

    if (reachedThreshold || isCritical || params.shouldBlockUser) {
      this.blockUser(
        params.targetId,
        params.targetName,
        params.targetAvatar,
        reachedThreshold
          ? `Автоматичне блокування: ${currentCount} скарги від користувачів`
          : `Скаргу подано: ${categoryTitle}`,
        true
      );
    }

    this.saveState();
    sounds.playPop();

    // Sync to Firestore reports collection
    this.syncReportToFirestore(newReport);

    return newReport;
  }

  /**
   * Trigger SOS Emergency response in a chat or hangout
   */
  public triggerSosAlert(params: {
    interlocutorId?: string;
    interlocutorName?: string;
    venueName?: string;
    locationNote?: string;
  }): {
    success: boolean;
    interlocutorBlocked: boolean;
    angelaPhrase: string;
    emergencyNumber: string;
  } {
    let interlocutorBlocked = false;
    if (params.interlocutorId && params.interlocutorName) {
      this.blockUser(
        params.interlocutorId,
        params.interlocutorName,
        undefined,
        'Екстрене блокування через кнопку SOS',
        true
      );
      interlocutorBlocked = true;
    }

    sounds.playLevelUp();

    pushNotificationService.triggerLocalNotification({
      type: 'system',
      title: '🚨 Активовано режим безпеки SOS',
      body: `Співрозмовника заблоковано. Зверніться до бармена з кодовою фразою «Чи тут Анжела?» або зателефонуйте 112.`,
      actionText: 'Допомога',
    });

    return {
      success: true,
      interlocutorBlocked,
      angelaPhrase: 'Чи можу я покликати Анжелу? (Ask for Angela)',
      emergencyNumber: '112 / 102',
    };
  }

  /**
   * Filter out blocked buddies from lists
   */
  public filterBlockedBuddies(buddies: BuddyProfile[]): BuddyProfile[] {
    return buddies.filter((b) => !this.isUserBlocked(b.id));
  }

  /**
   * Filter out blocked hangouts from feeds
   */
  public filterBlockedHangouts(hangouts: HangoutAlert[]): HangoutAlert[] {
    return hangouts.filter((h) => !this.isUserBlocked(h.userId));
  }

  /**
   * Filter out blocked meetups from feeds
   */
  public filterBlockedMeetups(meetups: GroupMeetup[]): GroupMeetup[] {
    return meetups.filter((m) => !this.isUserBlocked(m.creatorId));
  }

  private async syncReportToFirestore(report: UserReport) {
    try {
      const docRef = doc(db, 'reports', report.id);
      await setDoc(docRef, {
        ...report,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Firestore] Reports sync warning:', err);
    }
  }
}

export const safetyModerationService = new SafetyModerationService();
