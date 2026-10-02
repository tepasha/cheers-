import { BuddyProfile, FilterSettings } from '../types';
import { POPULAR_INTERESTS } from '../data/mockData';

export const MAX_FILTER_DISTANCE_KM = 5;

export const DEFAULT_FILTERS: FilterSettings = {
  maxDistance: MAX_FILTER_DISTANCE_KM,
  drinks: [],
  moods: [],
  paymentRules: [],
  interests: [],
  searchQuery: '',
};

export function countActiveFilters(filters: FilterSettings): number {
  let count = 0;
  if (filters.maxDistance < MAX_FILTER_DISTANCE_KM) count += 1;
  count += filters.drinks.length + filters.interests.length + filters.moods.length;
  if (filters.searchQuery?.trim()) count += 1;
  return count;
}

export function filterBuddies(buddies: BuddyProfile[], filters: FilterSettings): BuddyProfile[] {
  const query = filters.searchQuery?.trim().toLowerCase() ?? '';

  const interestKeywords = filters.interests.length
    ? POPULAR_INTERESTS.filter((pi) => filters.interests.includes(pi.id)).flatMap((pi) => [
        ...pi.keywords.map((k) => k.toLowerCase()),
        pi.label.toLowerCase(),
      ])
    : [];

  return buddies.filter((b) => {
    if (b.distanceKm > filters.maxDistance) return false;
    if (filters.drinks.length > 0 && !filters.drinks.some((d) => b.preferredDrinks.includes(d))) return false;
    if (filters.moods.length > 0 && !filters.moods.includes(b.currentMood)) return false;

    if (interestKeywords.length > 0) {
      const text = [...b.talkTopics, b.bio, b.tagline, ...b.favoriteBars].join(' ').toLowerCase();
      if (!interestKeywords.some((kw) => text.includes(kw))) return false;
    }

    if (query) {
      const corpus = [b.name, b.tagline, b.bio, b.locationName, ...b.talkTopics, ...b.favoriteBars].join(' ').toLowerCase();
      if (!corpus.includes(query)) return false;
    }

    return true;
  });
}
