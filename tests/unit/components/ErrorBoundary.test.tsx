import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from 'react-native';

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  openURL: vi.fn(),
  capture: vi.fn(),
  supportUri: 'https://example.com/support' as string | null,
}));
vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', Modal: 'Modal',
  Linking: { openURL: mocks.openURL },
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 10, left: 0, right: 0 }) }));
vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.copy }));
vi.mock('@/components/ui', () => ({ Button: 'Button' }));
vi.mock('@/services/telemetry', () => ({ captureException: mocks.capture }));
vi.mock('@/services/globalErrors', () => ({ installGlobalErrorHandlers: () => () => {} }));
vi.mock('@/services/support', () => ({ get supportContactUri() { return mocks.supportUri; } }));
vi.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: { settings: { language: 'uk' } }) => unknown) => selector({ settings: { language: 'uk' } }),
}));

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { clearAppError, reportAppError } from '@/services/appErrors';
import { ModalLayer } from '@/components/ModalLayer';
import { Button } from '@/components/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let mounted: ReactTestRenderer;
let shouldCrash: boolean;
let failure: Error;

function AppContent() {
  if (shouldCrash) throw failure;
  return <React.Fragment>Working app</React.Fragment>;
}

function crash() {
  act(() => { mounted = create(<ErrorBoundary><AppContent /></ErrorBoundary>); });
}

const press = async (label: string) => {
  await act(async () => { await mounted.root.findByProps({ label }).props.onPress(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  clearAppError();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.copy.mockResolvedValue(true);
  mocks.openURL.mockResolvedValue(undefined);
  mocks.supportUri = 'https://example.com/support';
  shouldCrash = true;
  failure = new TypeError(`Unable to load the meeting\n${'diagnostic detail '.repeat(30)}`);
});

afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  vi.restoreAllMocks();
});

describe('recovering from an application render error', () => {
  it('reports the exception, shows a short message and copies the full diagnostic text', async () => {
    crash();
    expect(mocks.capture).toHaveBeenCalledWith(failure);
    const summary = mounted.root.findByProps({ accessibilityRole: 'alert', selectable: true }).props.children;
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary).not.toContain('\n');
    await press('Копіювати');
    expect(mocks.copy).toHaveBeenCalledWith(`TypeError: ${failure.message.trim()}`);
    expect(mounted.root.findByProps({ label: 'Скопійовано' })).toBeTruthy();
  });

  it.each(['reject', 'false'])('keeps the screen usable when clipboard access fails (%s)', async (result) => {
    if (result === 'reject') mocks.copy.mockRejectedValueOnce(new Error('Clipboard denied'));
    else mocks.copy.mockResolvedValueOnce(false);
    crash();
    await press('Копіювати');
    expect(mounted.root.findAllByProps({ label: 'Скопійовано' })).toHaveLength(0);
    expect(JSON.stringify(mounted.toJSON())).toContain('скопіюйте вручну');
    await press('Копіювати');
    expect(mounted.root.findByProps({ label: 'Скопійовано' })).toBeTruthy();
  });

  it('opens the configured support contact and recovers from a failed link', async () => {
    mocks.openURL.mockRejectedValueOnce(new Error('No handler'));
    crash();
    await press('Технічна підтримка');
    expect(mocks.openURL).toHaveBeenCalledWith('https://example.com/support');
    expect(JSON.stringify(mounted.toJSON())).toContain('Не вдалося відкрити підтримку');
    await press('Технічна підтримка');
    expect(JSON.stringify(mounted.toJSON())).not.toContain('Не вдалося відкрити підтримку');
  });

  it('keeps support visible with an explanation when no contact is configured', () => {
    mocks.supportUri = null;
    crash();
    expect(mounted.root.findByProps({ label: 'Технічна підтримка' }).props.disabled).toBe(true);
    expect(JSON.stringify(mounted.toJSON())).toContain('Контакт підтримки ще не налаштовано.');
  });

  it('mounts a fresh application tree when the user retries', async () => {
    crash();
    shouldCrash = false;
    await press('Спробувати ще раз');
    expect(JSON.stringify(mounted.toJSON())).toContain('Working app');
  });

  it('presents asynchronous failures over the current sheet and keeps the form mounted on retry', async () => {
    shouldCrash = false;
    const cleanup = vi.fn();
    const retry = vi.fn();
    function Form() {
      const [draft, setDraft] = React.useState('draft');
      React.useEffect(() => cleanup, []);
      return <ModalLayer visible onClose={() => {}}><React.Fragment>{draft}<Button label="Edit" onPress={() => setDraft('saved draft')} /></React.Fragment></ModalLayer>;
    }
    act(() => { mounted = create(<ErrorBoundary><Form /></ErrorBoundary>); });
    await press('Edit');
    act(() => reportAppError(new Error('Backend failed'), { message: 'Readable failure', retry }));
    const modal = mounted.root.findByType(Modal);
    expect(modal.props.transparent).toBe(false);
    expect(JSON.stringify(mounted.toJSON())).toContain('Readable failure');
    await press('Спробувати ще раз');
    expect(retry).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
    expect(JSON.stringify(mounted.toJSON())).toContain('saved draft');
  });

  it('also catches render failures inside a modal sheet', () => {
    const sheetError = new Error('Sheet failed');
    function BrokenSheet(): React.ReactNode { throw sheetError; }
    act(() => { mounted = create(<ErrorBoundary><ModalLayer visible onClose={() => {}}><BrokenSheet /></ModalLayer></ErrorBoundary>); });
    expect(mocks.capture).toHaveBeenCalledWith(sheetError);
    expect(mounted.root.findByProps({ accessibilityRole: 'alert', selectable: true }).props.children).toContain('Sheet failed');
  });
});
