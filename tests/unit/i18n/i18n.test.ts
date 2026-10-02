import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { en } from '@/i18n/phrases/en';
import { pl } from '@/i18n/phrases/pl';
import { de } from '@/i18n/phrases/de';
import { ph, tr } from '@/services/i18nService';

const SRC = join(process.cwd(), 'src');
const CYRILLIC = /[А-Яа-яІіЇїЄєҐґ]/;

// Files that intentionally keep Ukrainian text: translation tables themselves, and content that is
// Ukrainian by nature (toast texts, venue descriptions, Kyiv place names).
const CONTENT_FILES = new Set(['data/toastsData.ts', 'data/venuesData.ts', 'services/geoService.ts', 'services/i18nService.ts']);
const SKIP_DIRS = new Set(['i18n', 'typings']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

interface Scan {
  keys: Set<string>;
  violations: string[];
}

function scan(): Scan {
  const keys = new Set<string>();
  const violations: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const rel = relative(SRC, file).split(sep).join('/');
    const lines = text.split('\n');

    const isContent = CONTENT_FILES.has(rel);
    // Content files may keep Ukrainian text, but explicit tr()/ph() calls in them still register their keys
    const report = (node: ts.Node, what: string) => {
      if (isContent) return;
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
      if (lines[line].includes('i18n-ignore')) return;
      violations.push(`${rel}:${line + 1}  ${what}`);
    };

    const isMarkedArg = (node: ts.Node): boolean => {
      const p = node.parent;
      return (
        !!p &&
        ts.isCallExpression(p) &&
        p.arguments[0] === node &&
        ts.isIdentifier(p.expression) &&
        (p.expression.text === 'tr' || p.expression.text === 'ph')
      );
    };

    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (CYRILLIC.test(node.text)) {
          if (isMarkedArg(node)) keys.add(node.text);
          // import paths, JSX attribute strings that are not user text, etc. are not Cyrillic, so only real text lands here
          else report(node, `untranslated string: ${JSON.stringify(node.text.slice(0, 60))}`);
        }
      } else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
        if (parts.some((p) => CYRILLIC.test(p))) report(node, `template with Ukrainian text (use tr('… {name}', …)): ${JSON.stringify(parts.join('${}').slice(0, 60))}`);
      } else if (ts.isJsxText(node)) {
        if (CYRILLIC.test(node.text)) report(node, `untranslated JSX text: ${JSON.stringify(node.text.trim().slice(0, 60))}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { keys, violations };
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const { keys, violations } = scan();

// Developer aid: I18N_DUMP=file npx vitest run src/i18n  writes the open violations and the phrase list
if (process.env.I18N_DUMP) writeFileSync(process.env.I18N_DUMP, JSON.stringify({ violations, keys: [...keys] }, null, 1));

describe('localization completeness', () => {
  it('has no Ukrainian UI text outside tr()/ph() (mark intentional exceptions with `i18n-ignore`)', () => {
    expect(violations).toEqual([]);
  });

  for (const [name, dict] of [['en', en], ['pl', pl], ['de', de]] as const) {
    describe(name, () => {
      it('translates every phrase used in the code', () => {
        const missing = [...keys].filter((k) => !dict[k]);
        expect(missing).toEqual([]);
      });

      it('has no stale entries for phrases that no longer exist', () => {
        const stale = Object.keys(dict).filter((k) => !keys.has(k));
        expect(stale).toEqual([]);
      });

      it('keeps the same {placeholders} as the source phrase', () => {
        const bad = Object.entries(dict)
          .filter(([k, v]) => placeholders(k) !== placeholders(v))
          .map(([k, v]) => `${k}  →  ${v}`);
        expect(bad).toEqual([]);
      });

      it('is actually translated (no Ukrainian left, no empty values)', () => {
        const bad = Object.entries(dict)
          .filter(([, v]) => !v.trim() || CYRILLIC.test(v))
          .map(([k]) => k);
        expect(bad).toEqual([]);
      });
    });
  }
});

describe('tr()', () => {
  it('returns Ukrainian unchanged, with parameters filled in', () => {
    expect(tr('Скарга на {name}', 'uk', { name: 'Іра' })).toBe('Скарга на Іра');
  });

  it('falls back to the Ukrainian text for unknown phrases and languages', () => {
    expect(tr('Немає такої фрази', 'en')).toBe('Немає такої фрази');
    expect(tr('Немає такої фрази', undefined)).toBe('Немає такої фрази');
  });

  it('leaves unknown placeholders intact and ph() is the identity', () => {
    expect(tr('Привіт, {name} {x}', 'uk', { name: 'А' })).toBe('Привіт, А {x}');
    expect(ph('Фраза')).toBe('Фраза');
  });
});
