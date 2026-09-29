import { describe, it, expect } from 'vitest';
import { 
  DRINK_METADATA, 
  MOOD_METADATA, 
  PAYMENT_METADATA, 
  POPULAR_INTERESTS, 
  INITIAL_BUDDIES, 
  INITIAL_HANGOUTS, 
  INITIAL_CHATS 
} from './mockData';
import { ALL_TOASTS, TOAST_CATEGORIES } from './toastsData';

describe('mockData integrity tests', () => {
  it('should have complete metadata for all drinks', () => {
    const keys = Object.keys(DRINK_METADATA);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    keys.forEach(k => {
      const meta = DRINK_METADATA[k as keyof typeof DRINK_METADATA];
      expect(meta.label).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.color).toBeTruthy();
    });
  });

  it('should have complete metadata for all moods and payments', () => {
    expect(Object.keys(MOOD_METADATA).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(PAYMENT_METADATA).length).toBe(4);
    expect(PAYMENT_METADATA.split_50_50.badge).toContain('50/50');
  });

  it('should ensure INITIAL_BUDDIES, INITIAL_HANGOUTS, and INITIAL_CHATS are clean empty arrays', () => {
    expect(INITIAL_BUDDIES).toHaveLength(0);
    expect(INITIAL_HANGOUTS).toHaveLength(0);
    expect(INITIAL_CHATS).toHaveLength(0);
  });

  it('should validate Ukrainian toasts collection in ALL_TOASTS', () => {
    expect(ALL_TOASTS.length).toBeGreaterThanOrEqual(15);
    expect(TOAST_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    ALL_TOASTS.forEach(toast => {
      expect(toast.id).toBeTruthy();
      expect(toast.text).toBeTruthy();
      expect(toast.category).toBeTruthy();
    });
  });

  it('should validate popular interest categories have keywords', () => {
    expect(POPULAR_INTERESTS.length).toBeGreaterThanOrEqual(8);
    POPULAR_INTERESTS.forEach(cat => {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.keywords.length).toBeGreaterThan(0);
    });
  });
});
