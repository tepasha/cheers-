import { useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import { t as translate, tr, type TrParams } from '../services/i18nService';

/** Returns a translate function bound to the language in the store (id-keyed strings such as tab names) */
export function useT() {
  const lang = useAppSelector((s) => s.settings.language);
  return useCallback((key: string) => translate(key, lang), [lang]);
}

/** Translates Ukrainian phrases written in code: `const tr = useTr(); tr('Скарга на {name}', { name })` */
export function useTr() {
  const lang = useAppSelector((s) => s.settings.language);
  return useCallback((text: string, params?: TrParams) => tr(text, lang, params), [lang]);
}
