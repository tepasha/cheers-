import React, { useId, useLayoutEffect, useSyncExternalStore } from 'react';
import { Modal } from 'react-native';

interface Layer { children: React.ReactNode; onClose: () => void; transparent: boolean; animation: 'slide' | 'fade' | 'none' }
const layers = new Map<string, Layer>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => [...layers.values()].at(-1) ?? null;

/** One native presenter; nested sheets replace its content instead of presenting another iOS Modal. */
export function ModalLayer({ visible, onClose, children, transparent = true, animation = 'slide' }: {
  visible: boolean; onClose: () => void; children: React.ReactNode; transparent?: boolean; animation?: Layer['animation'];
}) {
  const id = useId();
  useLayoutEffect(() => {
    if (visible) layers.set(id, { children, onClose, transparent, animation });
    else layers.delete(id);
    notify();
  }, [id, visible, children, onClose, transparent, animation]);
  useLayoutEffect(() => () => { layers.delete(id); notify(); }, [id]);
  return null;
}

export function ModalHost() {
  const layer = useSyncExternalStore(subscribe, snapshot, snapshot);
  return <Modal visible={!!layer} transparent={layer?.transparent ?? true} animationType={layer?.animation ?? 'slide'} onRequestClose={() => layer?.onClose()}>{layer?.children}</Modal>;
}
