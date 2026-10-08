import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGoogleBirthday, parseGoogleBirthday } from '@/services/googleBirthday';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Google birthday import', () => {
  it('uses a complete primary birthday rather than another profile entry', () => {
    expect(parseGoogleBirthday({ birthdays: [
      { date: { year: 1991, month: 3, day: 4 } },
      { metadata: { primary: true }, date: { year: 1990, month: 2, day: 28 } },
    ] })).toBe('1990-02-28');
  });

  it.each([null, {}, { birthdays: [] }, { birthdays: [null] },
    { birthdays: [{ date: { month: 2, day: 28 } }] },
    { birthdays: [{ date: { year: 1990, month: 2, day: 30 } }] },
    { birthdays: [{ date: { year: 2990, month: 2, day: 28 } }] },
  ])('asks for a date when Google data is absent, incomplete or invalid: %j', (person) => {
    expect(parseGoogleBirthday(person)).toBeNull();
  });

  it('keeps an underage birthday so the age gate can reject it', () => {
    expect(parseGoogleBirthday({ birthdays: [{ date: { year: new Date().getFullYear() - 10, month: 1, day: 1 } }] })).not.toBeNull();
  });

  it('requests only birthdays using the access token in the header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ birthdays: [{ date: { year: 2000, month: 2, day: 29 } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchGoogleBirthday('token')).toBe('2000-02-29');
    expect(fetchMock).toHaveBeenCalledWith('https://people.googleapis.com/v1/people/me?personFields=birthdays', expect.objectContaining({ headers: { Authorization: 'Bearer token' } }));
  });

  it('falls back without blocking sign-in when permission is missing or the API fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchGoogleBirthday()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await fetchGoogleBirthday('token')).toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchGoogleBirthday('token')).toBeNull();
  });

  it('bounds the optional lookup so an unresponsive API cannot leave sign-in busy', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    })));
    const request = fetchGoogleBirthday('token');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await request).toBeNull();
  });
});
