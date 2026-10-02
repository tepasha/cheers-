import { BuddyProfile, GroupMeetup } from '../../types';
import type { AppThunk } from '../hooks';
import { meetupUpserted } from '../slices/meetupsSlice';
import { addBonusXp } from './gamification';
import { pushNotification } from './notifications';
import {
  addInvitees,
  buildMeetup,
  cancelMeetup as cancelMeetupLogic,
  CreateMeetupInput,
  joinMeetup as joinMeetupLogic,
  leaveMeetup as leaveMeetupLogic,
} from '../../logic/meetups';
import { firestoreSyncService } from '../../services/firestoreSyncService';
import { analyticsService } from '../../services/analyticsService';
import { sounds } from '../../services/soundService';
import { trFor } from './lang';

const findMeetup = (getState: () => { meetups: { items: GroupMeetup[] } }, id: string) =>
  getState().meetups.items.find((m) => m.id === id);

export const createMeetup =
  (params: Omit<CreateMeetupInput, 'creatorId' | 'creatorName' | 'creatorAvatar'>): AppThunk<GroupMeetup> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const user = getState().auth.user;
    const meetup = buildMeetup({
      ...params,
      creatorId: user.id,
      creatorName: user.name || tr('Ви'),
      creatorAvatar: user.avatar,
    });

    dispatch(meetupUpserted(meetup));
    sounds.playMatchCheer();
    dispatch(addBonusXp(75, tr('Заплановано групову зустріч «{title}»', { title: meetup.title })));
    dispatch(
      pushNotification({
        type: 'meetup_invite',
        title: tr('🗓️ Нова групова зустріч запланована!'),
        body: tr('«{title}» у закладі {venueName}', { title: meetup.title, venueName: meetup.venueName }),
        subtitle: tr('{scheduledDate} о {scheduledTime} (+75 XP)', { scheduledDate: meetup.scheduledDate, scheduledTime: meetup.scheduledTime }),
        venueName: meetup.venueName,
        actionText: tr('Переглянути'),
      })
    );
    analyticsService.trackMeetupAction('create', meetup.id, { venue: meetup.venueName });
    void firestoreSyncService.saveMeetup(meetup);
    return meetup;
  };

export const inviteToMeetup =
  (meetupId: string, buddies: BuddyProfile[]): AppThunk<number> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const meetup = findMeetup(getState, meetupId);
    if (!meetup) return 0;

    // Only the host edits the guest list (firestore.rules enforce it as well)
    if (meetup.creatorId !== getState().auth.user.id) return 0;

    const { meetup: updated, count } = addInvitees(meetup, buddies);
    if (count === 0) return 0;

    dispatch(meetupUpserted(updated));
    sounds.playClink();
    dispatch(addBonusXp(count * 20, tr('Запрошено {count} друзів до зустрічі «{title}»', { count, title: meetup.title })));

    const names = buddies.slice(0, 2).map((b) => b.name).join(', ') + (buddies.length > 2 ? ` ${tr('та ще {count}', { count: buddies.length - 2 })}` : '');
    dispatch(
      pushNotification({
        type: 'meetup_invite',
        title: tr('👥 Додано людей до зустрічі ({count})!', { count }),
        body: tr('Ви запросили {names} до «{title}»', { names, title: meetup.title }),
        subtitle: tr('{venueName} • {scheduledDate} о {scheduledTime}', { venueName: meetup.venueName, scheduledDate: meetup.scheduledDate, scheduledTime: meetup.scheduledTime }),
        venueName: meetup.venueName,
        actionText: tr('Переглянути'),
      })
    );
    analyticsService.trackMeetupAction('invite', meetupId, { count });
    void firestoreSyncService.saveMeetup(updated);
    return count;
  };

/** Returns false when the meetup is unknown or already full */
export const joinMeetup =
  (meetupId: string): AppThunk<boolean> =>
  (dispatch, getState) => {
    const tr = trFor(getState);
    const user = getState().auth.user;
    const meetup = findMeetup(getState, meetupId);
    if (!meetup) return false;

    const updated = joinMeetupLogic(meetup, { userId: user.id, userName: user.name || tr('Ви'), userAvatar: user.avatar });
    if (!updated) return false;

    dispatch(meetupUpserted(updated));
    sounds.playClink();
    dispatch(addBonusXp(35, tr('Приєднався до групової зустрічі «{title}»', { title: meetup.title })));
    dispatch(
      pushNotification({
        type: 'meetup_joined',
        title: tr('🍻 Ви приєдналися до групової зустрічі!'),
        body: tr('«{title}» у {venueName}', { title: meetup.title, venueName: meetup.venueName }),
        subtitle: tr('{scheduledDate} о {scheduledTime} (+35 XP)', { scheduledDate: meetup.scheduledDate, scheduledTime: meetup.scheduledTime }),
        venueName: meetup.venueName,
      })
    );
    analyticsService.trackMeetupAction('join', meetupId);
    const mine = updated.participants.find((p) => p.userId === user.id);
    if (mine) void firestoreSyncService.setMeetupParticipation(meetupId, user.id, mine);
    return true;
  };

export const leaveMeetup =
  (meetupId: string): AppThunk =>
  (dispatch, getState) => {
    const meetup = findMeetup(getState, meetupId);
    if (!meetup) return;
    const myId = getState().auth.user.id;
    const updated = leaveMeetupLogic(meetup, myId);
    dispatch(meetupUpserted(updated));
    sounds.playTap();
    analyticsService.trackMeetupAction('leave', meetupId);
    void firestoreSyncService.setMeetupParticipation(meetupId, myId, null);
  };

export const cancelMeetup =
  (meetupId: string): AppThunk =>
  (dispatch, getState) => {
    const meetup = findMeetup(getState, meetupId);
    if (!meetup) return;
    if (meetup.creatorId !== getState().auth.user.id) return;
    const updated = cancelMeetupLogic(meetup);
    dispatch(meetupUpserted(updated));
    sounds.playTap();
    analyticsService.trackMeetupAction('cancel', meetupId);
    void firestoreSyncService.saveMeetup(updated);
  };
