export interface PlayRelease {
  name?: string;
  versionCodes?: string[];
  status?: string;
  userFraction?: number;
  releaseNotes?: { language: string; text: string }[];
}
export interface PlayTrack {
  track?: string;
  releases?: PlayRelease[];
}
export function parseRollout(text: string | undefined): number;
export function planRollout(input: {
  internalTrack: PlayTrack | null;
  productionTrack: PlayTrack | null;
  versionCode: string | number;
  rollout: number;
}): { track: { track: string; releases: PlayRelease[] }; summary: string };
