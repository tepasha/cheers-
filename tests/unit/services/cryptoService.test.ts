import { describe, it, expect, vi } from 'vitest';
import { randomBytes, webcrypto } from 'node:crypto';

// expo-crypto is a native module; Node's CSPRNG is an equivalent stand-in for getRandomBytes
vi.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(randomBytes(n)) }));

import { cryptoService } from '@/services/cryptoService';

const APP_SECRET_SALT = 'budmo_kyiv_e2ee_2026_salt_v1';

describe('cryptoService', () => {
  it('round-trips unicode text', async () => {
    const text = 'Будьмо! 🍻 Зустрічаємось о 19:00';
    const cipher = await cryptoService.encryptMessage(text, 'chat-1');
    expect(cryptoService.isEncrypted(cipher)).toBe(true);
    expect(cipher).not.toContain('Будьмо');
    expect(await cryptoService.decryptMessage(cipher, 'chat-1')).toBe(text);
  });

  it('uses a fresh IV for every message', async () => {
    const a = await cryptoService.encryptMessage('same', 'chat-1');
    const b = await cryptoService.encryptMessage('same', 'chat-1');
    expect(a).not.toBe(b);
  });

  it('cannot decrypt with another room key', async () => {
    const cipher = await cryptoService.encryptMessage('secret', 'chat-1');
    expect(await cryptoService.decryptMessage(cipher, 'chat-2')).toContain('Не вдалося розшифрувати');
  });

  it('passes through legacy plaintext and empty payloads', async () => {
    expect(await cryptoService.decryptMessage('plain text', 'chat-1')).toBe('plain text');
    expect(await cryptoService.decryptMessage('', 'chat-1')).toBe('');
    expect(await cryptoService.encryptMessage('', 'chat-1')).toBe('');
  });

  it('decodes legacy "fallback" payloads written by the old web client', async () => {
    const legacy = `enc:v1:fallback:${btoa(encodeURIComponent('Привіт'))}`;
    expect(await cryptoService.decryptMessage(legacy, 'chat-1')).toBe('Привіт');
  });

  it('is wire-compatible with the former WebCrypto implementation', async () => {
    // Re-implement the old web client's encryption with WebCrypto and make sure we can read it
    const subtle = webcrypto.subtle;
    const enc = new TextEncoder();
    const chatId = 'chat-compat';
    const material = await subtle.importKey('raw', enc.encode(`${APP_SECRET_SALT}::${chatId}`), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(`salt_${chatId}`), iterations: 10000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode('from the web app')));
    const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

    expect(await cryptoService.decryptMessage(`enc:v1:${b64(iv)}:${b64(encrypted)}`, chatId)).toBe('from the web app');
  });

  it('writes v2 and reads v1: old messages stay readable after the switch to HKDF', async () => {
    expect(await cryptoService.encryptMessage('new', 'chat-1')).toMatch(/^enc:v2:/);
    expect(cryptoService.isEncrypted('enc:v1:a:b')).toBe(true);
    expect(cryptoService.isEncrypted('enc:v2:a:b')).toBe(true);
    expect(cryptoService.isEncrypted('enc:v3:a:b')).toBe(false);
  });

  it('derives the v2 key with standard HKDF-SHA256 (checked against WebCrypto)', async () => {
    const subtle = webcrypto.subtle;
    const enc = new TextEncoder();
    const chatId = 'chat-hkdf';
    const material = await subtle.importKey('raw', enc.encode(APP_SECRET_SALT), 'HKDF', false, ['deriveKey']);
    const key = await subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('budmo/chat-key/v2'), info: enc.encode(chatId) },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const ours = (await cryptoService.encryptMessage('from the phone', chatId)).split(':');
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(ours[2], 'base64') }, key, Buffer.from(ours[3], 'base64'));
    expect(new TextDecoder().decode(plain)).toBe('from the phone');
  });

  it('a v2 payload is not readable with the v1 key, and every room has its own v2 key', async () => {
    const cipher = await cryptoService.encryptMessage('secret', 'chat-1');
    const asV1 = cipher.replace('enc:v2:', 'enc:v1:');
    expect(await cryptoService.decryptMessage(asV1, 'chat-1')).toContain('Не вдалося розшифрувати');
    expect(await cryptoService.decryptMessage(cipher, 'chat-2')).toContain('Не вдалося розшифрувати');
  });

  it('produces a stable fingerprint per room', () => {
    expect(cryptoService.getRoomFingerprint('chat-1').fingerprint).toBe(cryptoService.getRoomFingerprint('chat-1').fingerprint);
    expect(cryptoService.getRoomFingerprint('chat-1').fingerprint).not.toBe(cryptoService.getRoomFingerprint('chat-2').fingerprint);
  });
});
