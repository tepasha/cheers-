export const REQUIRED_ENV: string[];
export function checkVersions(input: { tag?: string; appVersion?: string; packageVersion?: string }): string[];
export function checkProject(appJson: unknown): string[];
export function checkEnv(env: Record<string, string | undefined>): string[];
export const LEGAL_ENV: string[];
export function checkStore(input: { storeConfigText: string; env: Record<string, string | undefined> }): string[];
export function checkIdentifiers(appJson: unknown): string[];
