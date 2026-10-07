import type { Auth, User, UserCredential } from 'firebase/auth';

/** Browser preview: Sign in with Apple is offered on iOS only (App Store Guideline 4.8), so the button never shows here */
export class AppleSignInError extends Error {
  constructor(public code: 'apple/no-token', message: string) {
    super(message);
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(_auth: Auth): Promise<{ cred: UserCredential; fullName: string } | null> {
  return null;
}

export async function reauthenticateWithApple(_auth: Auth, _user: User): Promise<boolean> {
  return false;
}
