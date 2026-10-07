/**
 * Account deletion (App Store 5.1.1(v), Google Play account deletion policy). It runs on the server because the
 * client cannot do it completely: the rules rightly stop a user from touching other people's documents, yet their
 * name sits in other people's chats and meetups. With the Admin SDK this removes everything the privacy policy
 * promises, the same way for every sign-in method (a Google account has no password to re-enter), and deletes the
 * Firebase Auth user last, so a failure half-way can simply be retried.
 */

/** How recent the sign-in must be: the app re-authenticates (password or Google) right before calling */
export const RECENT_LOGIN_MS = 10 * 60 * 1000;

export class AccountError extends Error {
  constructor(public code: 'requires-recent-login') {
    super(code);
  }
}

export interface AccountDeps {
  /** Chats of this user: their profile line and participant entry are removed, their sent messages lose the sender name and avatar */
  forgetInChats(uid: string): Promise<number>;
  /** Seats taken at other people's tables are given back */
  leaveHangouts(uid: string): Promise<number>;
  /** Entries in other people's meetups are removed */
  leaveMeetups(uid: string): Promise<number>;
  /** Every document of `collection` whose `field` equals `uid` is deleted (own tables, own meetups, push devices) */
  deleteOwned(collection: 'hangouts' | 'group_meetups' | 'devices', field: 'userId' | 'creatorId' | 'uid', uid: string): Promise<number>;
  /** users/{uid} with every subcollection: private data, blocks, favorites, friends */
  deleteUserTree(uid: string): Promise<void>;
  deleteAuthUser(uid: string): Promise<void>;
}

export interface DeleteResult {
  chats: number;
  seatsReleased: number;
  meetupsLeft: number;
  hangouts: number;
  meetups: number;
  devices: number;
}

/**
 * `authTimeSec` is the `auth_time` claim of the caller's ID token. A deletion needs a fresh sign-in, so a phone left
 * unlocked is not enough to destroy someone's account. Client-owned profile fields cannot bypass this check.
 */
export async function deleteAccount(deps: AccountDeps, uid: string, authTimeSec: number | undefined, now: number): Promise<DeleteResult> {
  // Client-owned profile fields cannot exempt an account from reauthentication.
  const age = typeof authTimeSec === 'number' ? now - authTimeSec * 1000 : NaN;
  if (!Number.isFinite(age) || age < 0 || age > RECENT_LOGIN_MS) throw new AccountError('requires-recent-login');

  // Other people's documents first, then the user's own, the Auth user last: a retry after a failure finds the
  // account still there and finishes the job
  const chats = await deps.forgetInChats(uid);
  const seatsReleased = await deps.leaveHangouts(uid);
  const meetupsLeft = await deps.leaveMeetups(uid);
  const hangouts = await deps.deleteOwned('hangouts', 'userId', uid);
  const meetups = await deps.deleteOwned('group_meetups', 'creatorId', uid);
  const devices = await deps.deleteOwned('devices', 'uid', uid);
  await deps.deleteUserTree(uid);
  await deps.deleteAuthUser(uid);
  return { chats, seatsReleased, meetupsLeft, hangouts, meetups, devices };
}
