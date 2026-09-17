import { describe, it, expect } from 'vitest';
import { cryptoService } from './cryptoService';

describe('cryptoService', () => {
  const testChatId = 'chat-usr_123';
  const originalText = 'Привіт! Зустрінемось у барі Barman Dictat о 20:00? 🍻';

  it('should encrypt plaintext into an enc:v1: formatted ciphertext', async () => {
    const encrypted = await cryptoService.encryptMessage(originalText, testChatId);
    expect(cryptoService.isEncrypted(encrypted)).toBe(true);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    // Plaintext should NOT be visible in encrypted string
    expect(encrypted).not.toContain('Barman Dictat');
  });

  it('should decrypt encrypted ciphertext back to exact original plaintext', async () => {
    const encrypted = await cryptoService.encryptMessage(originalText, testChatId);
    const decrypted = await cryptoService.decryptMessage(encrypted, testChatId);
    expect(decrypted).toBe(originalText);
  });

  it('should handle unencrypted plaintext gracefully (backward compatibility)', async () => {
    const plain = 'Звичайне відкрите повідомлення';
    const result = await cryptoService.decryptMessage(plain, testChatId);
    expect(result).toBe(plain);
  });

  it('should generate a consistent room fingerprint for a chat', () => {
    const info1 = cryptoService.getRoomFingerprint(testChatId);
    const info2 = cryptoService.getRoomFingerprint(testChatId);
    expect(info1.algorithm).toBe('AES-GCM');
    expect(info1.keyLength).toBe('256-bit');
    expect(info1.fingerprint).toBe(info2.fingerprint);
  });
});
