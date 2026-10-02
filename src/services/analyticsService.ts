/**
 * Analytics facade. The former web build used gtag.js / firebase/analytics, neither of which
 * runs on React Native. Call sites keep the same typed tracking API; events go to an in-memory
 * ring buffer and to an optional transport that a native SDK can be plugged into later
 * (e.g. @react-native-firebase/analytics) without touching any screen.
 */

export interface AnalyticsEventEntry {
  id: string;
  timestamp: string;
  name: string;
  params?: Record<string, unknown>;
}

export type AnalyticsEvent = AnalyticsEventEntry;

export interface AnalyticsTransport {
  logEvent(name: string, params?: Record<string, unknown>): void;
  setUser(userId: string | null, properties?: Record<string, unknown>): void;
}

const MAX_EVENTS_HISTORY = 60;

class AnalyticsService {
  private transport: AnalyticsTransport | null = null;
  private recentEvents: AnalyticsEventEntry[] = [];
  private listeners = new Set<(event: AnalyticsEventEntry, allEvents: AnalyticsEventEntry[]) => void>();

  setTransport(transport: AnalyticsTransport | null): void {
    this.transport = transport;
  }

  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    const entry: AnalyticsEventEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      name: eventName,
      params,
    };

    this.recentEvents.unshift(entry);
    if (this.recentEvents.length > MAX_EVENTS_HISTORY) this.recentEvents.pop();

    try {
      this.transport?.logEvent(eventName, params);
    } catch (e) {
      console.warn('[Analytics] transport error:', e);
    }

    const all = [...this.recentEvents];
    this.listeners.forEach((cb) => {
      try {
        cb(entry, all);
      } catch (err) {
        console.error('Error in analytics listener:', err);
      }
    });
  }

  trackScreenView(screenName: string): void {
    this.trackEvent('screen_view', { screen_name: screenName });
  }

  trackTabSwitch(fromTab: string, toTab: string): void {
    this.trackEvent('tab_switch', { from_tab: fromTab, to_tab: toTab, event_category: 'navigation' });
  }

  trackVenueView(venueId: string, venueName: string, category?: string): void {
    this.trackEvent('venue_view', { venue_id: venueId, venue_name: venueName, venue_category: category || 'bar' });
  }

  trackVenueFavorite(venueId: string, venueName: string, isFavorite: boolean): void {
    this.trackEvent(isFavorite ? 'venue_favorite_add' : 'venue_favorite_remove', {
      venue_id: venueId,
      venue_name: venueName,
    });
  }

  trackMeetupAction(action: 'create' | 'join' | 'leave' | 'cancel' | 'invite', meetupId: string, params?: Record<string, unknown>): void {
    this.trackEvent(`meetup_${action}`, { meetup_id: meetupId, event_category: 'meetups', ...params });
  }

  trackBatterySaver(enabled: boolean): void {
    this.trackEvent('battery_saver_toggle', {
      enabled,
      mode: enabled ? 'low_power_90s' : 'standard_high_accuracy_15s',
      event_category: 'settings',
    });
  }

  trackLanguageChange(language: string, mode: 'auto_geo' | 'manual' = 'manual'): void {
    this.trackEvent('change_language', { language, selection_mode: mode, event_category: 'localization' });
  }

  trackSearch(searchTerm: string, resultsCount: number, category?: string): void {
    this.trackEvent('search', {
      search_term: searchTerm,
      results_count: resultsCount,
      search_category: category || 'all',
      event_category: 'discovery',
    });
  }

  trackSosTrigger(action: 'open_modal' | 'call_angela' | 'call_112' | 'copy_address'): void {
    this.trackEvent('sos_emergency_action', { action_type: action, event_category: 'safety', event_level: 'critical' });
  }

  setUser(userId: string | null, properties?: Record<string, unknown>): void {
    try {
      this.transport?.setUser(userId, properties);
    } catch (e) {
      console.warn('[Analytics] setUser error:', e);
    }
    this.trackEvent('user_identified', { user_id: userId || 'guest', ...properties });
  }

  getRecentEvents(): AnalyticsEventEntry[] {
    return [...this.recentEvents];
  }

  subscribe(callback: (event: AnalyticsEventEntry, allEvents: AnalyticsEventEntry[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const analyticsService = new AnalyticsService();
