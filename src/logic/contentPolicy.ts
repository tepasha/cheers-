/** A narrow pre-publication filter. Reports and human moderation handle context and evasion. */
const prohibited = /(?:kill yourself|i will kill you|rape you|child porn|дитяча порнографія|я тебе вб['’]?ю|зґвалтую тебе|zabiję cię|vergewaltige dich)/iu;
export const contentAllowed = (text: string): boolean => !prohibited.test(text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, ''));
export function requireAllowedContent(...values: Array<string | undefined>) {
  if (values.some((value) => value && !contentAllowed(value))) {
    throw Object.assign(new Error('Content violates the community policy'), { code: 'invalid-argument' });
  }
}
