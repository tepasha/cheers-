import { describe, expect, it } from 'vitest';
import { selectCanUseApp } from '@/store/selectors';
import { createGuestUser, createUser } from '@/logic/session';
import type { RootState } from '@/store/index';

const state = (user: ReturnType<typeof createUser>) => ({ auth: { user } }) as unknown as RootState;
const born = (years: number, offsetDays = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const user = (over: Record<string, unknown> = {}) => createUser({ id: 'u', email: 'u@b.co', emailVerified: true, birthDate: born(30), ...over });

describe('selectCanUseApp: signed in, e-mail verified AND age confirmed (21+)', () => {
  it('lets an adult with a verified account in', () => {
    expect(selectCanUseApp(state(user()))).toBe(true);
  });

  it('keeps out every state in which the app must neither read nor publish', () => {
    expect(selectCanUseApp(state(createGuestUser() as never))).toBe(false); // signed out
    expect(selectCanUseApp(state(user({ emailVerified: false })))).toBe(false); // e-mail not verified
    expect(selectCanUseApp(state(user({ birthDate: undefined })))).toBe(false); // first Google sign-in: age unknown
    expect(selectCanUseApp(state(user({ birthDate: born(19) })))).toBe(false); // too young
    expect(selectCanUseApp(state(user({ birthDate: 'garbage' })))).toBe(false); // unreadable
  });

  it('draws the line at the 21st birthday', () => {
    expect(selectCanUseApp(state(user({ birthDate: born(21) })))).toBe(true); // 21 today
    expect(selectCanUseApp(state(user({ birthDate: born(21, 1) })))).toBe(false); // 21 tomorrow
  });

  it('is memoized on its inputs, so unrelated profile edits do not recompute it', () => {
    const u = user();
    const a = state(u);
    expect(selectCanUseApp(a)).toBe(selectCanUseApp(state({ ...u, name: 'Renamed' })));
  });
});
