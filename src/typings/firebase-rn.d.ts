import type { Persistence } from 'firebase/auth';

// Metro resolves `firebase/auth` through the "react-native" export condition, which ships
// getReactNativePersistence, but the bundled TypeScript declarations only describe the web build.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
