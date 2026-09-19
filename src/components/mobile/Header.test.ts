import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firestoreSyncService } from '../../services/firestoreSyncService';

describe('Header & Network Status Listener for Firestore', () => {
  beforeEach(async () => {
    // Reset state before tests
    await firestoreSyncService.setBasementMode(false);
  });

  afterEach(async () => {
    await firestoreSyncService.setBasementMode(false);
  });

  it('should initially report online when basement mode is inactive and navigator is online', () => {
    const isOnline = firestoreSyncService.isOnline();
    expect(isOnline).toBe(true);
    expect(firestoreSyncService.isBasementMode()).toBe(false);
  });

  it('should detect offline mode when basement mode is enabled', async () => {
    const statusChanges: { online: boolean; basement: boolean }[] = [];
    const unsub = firestoreSyncService.onNetworkStatusChange((online, basement) => {
      statusChanges.push({ online, basement });
    });

    await firestoreSyncService.setBasementMode(true);

    expect(firestoreSyncService.isBasementMode()).toBe(true);
    expect(firestoreSyncService.isOnline()).toBe(false);

    // Latest notification should reflect offline
    const latest = statusChanges[statusChanges.length - 1];
    expect(latest.online).toBe(false);
    expect(latest.basement).toBe(true);

    unsub();
  });

  it('should restore online mode when basement mode is disabled', async () => {
    await firestoreSyncService.setBasementMode(true);
    expect(firestoreSyncService.isOnline()).toBe(false);

    await firestoreSyncService.setBasementMode(false);
    expect(firestoreSyncService.isOnline()).toBe(true);
    expect(firestoreSyncService.isBasementMode()).toBe(false);
  });

  it('should notify listeners when connection status is set explicitly', () => {
    const statusChanges: boolean[] = [];
    const unsub = firestoreSyncService.onNetworkStatusChange((online) => {
      statusChanges.push(online);
    });

    firestoreSyncService.setFirestoreConnectionStatus(false);
    expect(firestoreSyncService.isOnline()).toBe(false);
    expect(statusChanges[statusChanges.length - 1]).toBe(false);

    firestoreSyncService.setFirestoreConnectionStatus(true);
    expect(firestoreSyncService.isOnline()).toBe(true);
    expect(statusChanges[statusChanges.length - 1]).toBe(true);

    unsub();
  });

  it('should verify connection and return offline when basement mode is active', async () => {
    await firestoreSyncService.setBasementMode(true);
    const verified = await firestoreSyncService.verifyConnection();
    expect(verified).toBe(false);
  });
});
