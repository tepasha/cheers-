import { doc, setDoc } from 'firebase/firestore';
import { BlockedUserRecord, ReportCategory, ReportTargetType, UserReport } from '../../types';
import type { AppThunk } from '../hooks';
import { blocksSynced, reportFiled, userBlocked, userUnblocked } from '../slices/safetySlice';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { pushNotification } from './notifications';
import { REPORT_CATEGORIES } from '../../data/safetyData';
import { db } from '../../services/firebase';
import { sounds } from '../../services/soundService';
import { omitUndefined } from '../../utils/firestoreData';
import { formatClock } from '../../utils/time';
import { trFor } from './lang';

export const blockUser =
  (userId: string, userName: string, userAvatar?: string, reason?: string, autoBlocked = false): AppThunk<BlockedUserRecord> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const existing = getState().safety.blockedUsers.find((u) => u.userId === userId);
    if (existing) return existing;

    const record: BlockedUserRecord = {
      userId,
      userName,
      userAvatar,
      blockedAt: formatClock(),
      reason: reason ?? tr('Заблоковано користувачем'),
      autoBlocked,
    };

    dispatch(userBlocked(record));
    // Server-side enforcement: the rules consult this document when the blocked person tries to reach you
    void firestoreSyncService.saveBlock(getState().auth.user.id, record);
    sounds.playTap();
    dispatch(
      pushNotification({
        type: 'system',
        title: autoBlocked ? tr('🛡️ Анти-абуз: акаунт автозаблоковано') : tr('🚫 Користувача заблоковано'),
        body: autoBlocked
          ? tr('Акаунт {userName} отримав кілька скарг і був автоматично ізольований для безпеки спільноти.', { userName })
          : tr('Користувача {userName} заблоковано. Ви більше не бачитимете його кличі, повідомлення та профіль.', { userName }),
        actionText: tr('Керувати безпекою'),
      })
    );
    return record;
  };

export const unblockUser =
  (userId: string): AppThunk =>
  (dispatch, getState) => {
    dispatch(userUnblocked(userId));
    void firestoreSyncService.removeBlock(getState().auth.user.id, userId);
    sounds.playTap();
  };

/** Reconciles this device's block list with the cloud copy (run after sign-in with a verified email) */
export const syncBlocksFromCloud =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const userId = getState().auth.user.id;
    const cloud = await firestoreSyncService.getBlocks(userId);
    if (cloud === null) return; // unreadable: keep what we have

    const firstSync = getState().safety.cloudSyncedFor !== userId;
    if (firstSync) {
      const inCloud = new Set(cloud.map((r) => r.userId));
      // Blocks made on this device before they were stored in the cloud now become enforceable
      getState()
        .safety.blockedUsers.filter((r) => !inCloud.has(r.userId))
        .forEach((r) => void firestoreSyncService.saveBlock(userId, r));
    }
    dispatch(blocksSynced({ userId, records: cloud, merge: firstSync }));
  };

export interface SubmitReportParams {
  targetId: string;
  targetType: ReportTargetType;
  targetName: string;
  targetAvatar?: string;
  category: ReportCategory;
  comment: string;
  shouldBlockUser?: boolean;
}

/** Files a report and auto-blocks on critical categories or on the second report against a user */
export const submitReport =
  (params: SubmitReportParams): AppThunk<UserReport> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const state = getState();
    const categoryDef = REPORT_CATEGORIES.find((c) => c.id === params.category);
    const categoryTitle = categoryDef ? categoryDef.title : 'Скарга на контент'; // i18n-ignore: stored for moderators, always Ukrainian

    const report: UserReport = {
      id: `rep-${Date.now()}`,
      reporterId: state.auth.user.id || 'me',
      reporterName: state.auth.user.name || 'Ви', // i18n-ignore: stored for moderators
      targetId: params.targetId,
      targetType: params.targetType,
      targetName: params.targetName,
      targetAvatar: params.targetAvatar,
      category: params.category,
      categoryTitle,
      comment: params.comment.trim(),
      timestamp: formatClock(),
      createdAt: Date.now(),
      status: 'pending',
    };

    const newCount = (state.safety.reportCounts[params.targetId] || 0) + 1;
    dispatch(reportFiled(report));

    const reachedThreshold = newCount >= 2;
    if (reachedThreshold || categoryDef?.severity === 'critical' || params.shouldBlockUser) {
      dispatch(
        blockUser(
          params.targetId,
          params.targetName,
          params.targetAvatar,
          reachedThreshold ? tr('Автоматичне блокування: {newCount} скарги від користувачів', { newCount }) : tr('Скаргу подано: {categoryTitle}', { categoryTitle }),
          true
        )
      );
    }

    sounds.playPop();
    setDoc(doc(db, 'reports', report.id), omitUndefined({ ...report, syncedAt: new Date().toISOString() })).catch((err) =>
      console.warn('[Firestore] Reports sync warning:', err)
    );
    return report;
  };

export const triggerSosAlert =
  (params: { interlocutorId?: string; interlocutorName?: string }): AppThunk<{
    interlocutorBlocked: boolean;
    angelaPhrase: string;
    emergencyNumber: string;
  }> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    let interlocutorBlocked = false;
    if (params.interlocutorId && params.interlocutorName) {
      dispatch(blockUser(params.interlocutorId, params.interlocutorName, undefined, tr('Екстрене блокування через кнопку SOS'), true));
      interlocutorBlocked = true;
    }

    sounds.playLevelUp();
    dispatch(
      pushNotification({
        type: 'safety_alert',
        title: tr('🚨 Активовано режим безпеки SOS'),
        body: tr('Зверніться до бармена з кодовою фразою «Чи тут Анжела?» або зателефонуйте 112.'),
        actionText: tr('Допомога'),
      })
    );

    return {
      interlocutorBlocked,
      angelaPhrase: tr('Чи можу я покликати Анжелу? (Ask for Angela)'),
      emergencyNumber: '112 / 102',
    };
  };
