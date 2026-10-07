import { BlockedUserRecord, ReportCategory, ReportTargetType, UserReport } from '../../types';
import type { AppThunk } from '../hooks';
import { blocksSynced, reportFiled, userBlocked, userUnblocked } from '../slices/safetySlice';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { pushNotification } from './notifications';
import { REPORT_CATEGORIES } from '../../data/safetyData';
import { sounds } from '../../services/soundService';
import { formatClock } from '../../utils/time';
import { trFor } from './lang';
import { queueSync } from './outbox';

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
    dispatch(queueSync('saveBlock', `block:${userId}`, [getState().auth.user.id, record]));
    sounds.playTap();
    dispatch(
      pushNotification({
        type: 'system',
        title: tr('🚫 Користувача заблоковано'),
        body: tr('Користувача {userName} заблоковано. Ви більше не бачитимете його кличі, повідомлення та профіль.', { userName }),
        actionText: tr('Керувати безпекою'),
      })
    );
    return record;
  };

export const unblockUser =
  (userId: string): AppThunk =>
  (dispatch, getState) => {
    dispatch(userUnblocked(userId));
    dispatch(queueSync('removeBlock', `block:${userId}`, [getState().auth.user.id, userId]));
    sounds.playTap();
  };

/** Reconciles this device's block list with the cloud copy (run after sign-in with a verified email) */
export const syncBlocksFromCloud =
  (): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const userId = getState().auth.user.id;
    const current = captureSession(getState);
    const cloud = await firestoreSyncService.getBlocks(userId);
    if (!current()) return;
    if (cloud === null) return; // unreadable: keep what we have

    const firstSync = getState().safety.cloudSyncedFor !== userId;
    if (firstSync) {
      const inCloud = new Set(cloud.map((r) => r.userId));
      // Blocks made on this device before they were stored in the cloud now become enforceable
      getState()
        .safety.blockedUsers.filter((r) => !inCloud.has(r.userId))
        .forEach((r) => dispatch(queueSync('saveBlock', `block:${r.userId}`, [userId, r])));
    }
    dispatch(blocksSynced({ userId, records: cloud, merge: firstSync }));
  };

export interface SubmitReportParams {
  targetId: string;
  targetType: ReportTargetType;
  contextId?: string;
  targetName: string;
  targetAvatar?: string;
  category: ReportCategory;
  comment: string;
  shouldBlockUser?: boolean;
}

/** Files a report for moderator review; blocking is a separate explicit user choice. */
export const submitReport =
  (params: SubmitReportParams): AppThunk<UserReport> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const state = getState();
    const categoryDef = REPORT_CATEGORIES.find((c) => c.id === params.category);
    const categoryTitle = categoryDef ? categoryDef.title : 'Скарга на контент'; // i18n-ignore: stored for moderators, always Ukrainian

    const report: UserReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      reporterId: state.auth.user.id || 'me',
      reporterName: state.auth.user.name || 'Ви', // i18n-ignore: stored for moderators
      targetId: params.targetId,
      targetType: params.targetType,
      contextId: params.contextId,
      targetName: params.targetName,
      targetAvatar: params.targetAvatar,
      category: params.category,
      categoryTitle,
      comment: params.comment.trim(),
      timestamp: formatClock(),
      createdAt: Date.now(),
      status: 'pending',
    };

    dispatch(reportFiled(report));

    if (params.shouldBlockUser) {
      dispatch(
        blockUser(
          params.targetId,
          params.targetName,
          params.targetAvatar,
          tr('Скаргу подано: {categoryTitle}', { categoryTitle }),
          false
        )
      );
    }

    sounds.playPop();
    dispatch(queueSync('saveReport', `report:${report.id}`, [report]));
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
      dispatch(submitReport({ targetId: params.interlocutorId, targetName: params.interlocutorName, targetType: 'profile', category: 'suspicious', comment: '', shouldBlockUser: false }));
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
      emergencyNumber: '112',
    };
  };
import { captureSession } from '../sessionGuard';
