import { describe, expect, it } from 'vitest';
import { AccountError, RECENT_LOGIN_MS, deleteAccount, type AccountDeps } from '../../../functions/src/account';

/** Records the order of the steps; `completed` says whether the account already has a birth date */
function fakeDeps(_completed = true, failAt?: string) {
  const steps: string[] = [];
  const step = (name: string, result = 1) => async () => {
    steps.push(name);
    if (name === failAt) throw new Error(`${name} failed`);
    return result;
  };
  const deps: AccountDeps = {
    forgetInChats: step('chats', 3),
    leaveHangouts: step('leaveHangouts', 2),
    leaveMeetups: step('leaveMeetups', 1),
    deleteOwned: async (collection) => {
      steps.push(`delete:${collection}`);
      if (`delete:${collection}` === failAt) throw new Error('failed');
      return 4;
    },
    deleteUserTree: async () => {
      steps.push('userTree');
    },
    deleteAuthUser: async () => {
      steps.push('auth');
    },
  };
  return { deps, steps };
}

const NOW = 1_800_000_000_000;
const sec = (ms: number) => Math.floor(ms / 1000);

describe('deleteAccount (server)', () => {
  it('removes data from other people\'s documents first, the own documents next, the sign-in last', async () => {
    const { deps, steps } = fakeDeps();
    const result = await deleteAccount(deps, 'u1', sec(NOW - 60_000), NOW);
    expect(steps).toEqual(['chats', 'leaveHangouts', 'leaveMeetups', 'delete:hangouts', 'delete:group_meetups', 'delete:devices', 'userTree', 'auth']);
    expect(result).toEqual({ chats: 3, seatsReleased: 2, meetupsLeft: 1, hangouts: 4, meetups: 4, devices: 4 });
  });

  it('refuses without a recent sign-in (an unlocked phone is not enough)', async () => {
    const { deps, steps } = fakeDeps();
    await expect(deleteAccount(deps, 'u1', sec(NOW - RECENT_LOGIN_MS - 60_000), NOW)).rejects.toBeInstanceOf(AccountError);
    await expect(deleteAccount(deps, 'u1', undefined, NOW)).rejects.toThrow('requires-recent-login');
    expect(steps).toEqual([]);
  });

  it('accepts a sign-in exactly at the limit', async () => {
    const { deps } = fakeDeps();
    await expect(deleteAccount(deps, 'u1', sec(NOW - RECENT_LOGIN_MS), NOW)).resolves.toBeTruthy();
  });

  it('removing the birth-date marker cannot bypass a fresh sign-in', async () => {
    const { deps, steps } = fakeDeps(false);
    await expect(deleteAccount(deps, 'u1', sec(NOW - 3 * 3600_000), NOW)).rejects.toThrow('requires-recent-login');
    expect(steps).toEqual([]);
  });

  it('rejects a missing or future auth_time even without a profile', async () => {
    const { deps, steps } = fakeDeps(false);
    await expect(deleteAccount(deps, 'u1', undefined, NOW)).rejects.toThrow('requires-recent-login');
    await expect(deleteAccount(deps, 'u1', sec(NOW + 60_000), NOW)).rejects.toThrow('requires-recent-login');
    expect(steps).toEqual([]);
  });

  it('a failure half-way keeps the sign-in, so the person can simply try again', async () => {
    const { deps, steps } = fakeDeps(true, 'delete:group_meetups');
    await expect(deleteAccount(deps, 'u1', sec(NOW), NOW)).rejects.toThrow();
    expect(steps).not.toContain('auth');
    expect(steps).not.toContain('userTree');
  });
});
