import type { RootState } from '../index';
import { tr as translate, type TrParams } from '../../services/i18nService';

/**
 * Translator bound to the language in the store, for thunks that create user-visible text
 * (notifications, system messages). Use under the name `tr` so the localization test finds the phrases:
 * `const tr = trFor(getState); tr('Нова зустріч «{title}»', { title })`.
 * The text is translated when it is created, so it stays in the language the user had at that moment.
 */
export const trFor =
  (getState: () => RootState) =>
  (text: string, params?: TrParams): string =>
    translate(text, getState().settings.language, params);
