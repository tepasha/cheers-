/**
 * Google Analytics (GA4) & Firebase Analytics Integration Service
 * 
 * Provides unified analytics tracking across the application:
 * - Google Analytics 4 via gtag.js script injection & dataLayer
 * - Firebase Analytics (getAnalytics, isSupported, logEvent)
 * - Navigation & Screen tracking (tab switching, screen views)
 * - Feature usage tracking (Meetups, Venues, Friends, Battery Saver, SOS)
 * - In-memory event buffer for testing, debugging and UI live telemetry
 */

import { firebaseApp, firebaseConfig } from './firebase';

export interface AnalyticsEventEntry {
  id: string;
  timestamp: string;
  name: string;
  params?: Record<string, unknown>;
}

export type AnalyticsEvent = AnalyticsEventEntry;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

class AnalyticsService {
  private measurementId: string;
  private isInitialized = false;
  private firebaseAnalyticsInstance: unknown = null;
  private recentEvents: AnalyticsEventEntry[] = [];
  private readonly MAX_EVENTS_HISTORY = 60;
  private listeners: Set<(event: AnalyticsEventEntry, allEvents: AnalyticsEventEntry[]) => void> = new Set();

  constructor() {
    // Determine Measurement ID with fallback to standard configured Firebase/GA ID
    const rawId = 
      import.meta.env.VITE_GA_MEASUREMENT_ID ||
      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
      (firebaseConfig as { measurementId?: string }).measurementId ||
      'G-WG0NLYM38P';
    
    const sanitized = (rawId || '').trim().replace(/^["']+|["']+$/g, '');
    this.measurementId = (sanitized && /^G-[A-Z0-9]+$/i.test(sanitized)) ? sanitized : 'G-WG0NLYM38P';
  }

  /**
   * Initializes Google Analytics (gtag.js) and Firebase Analytics
   */
  async init(customMeasurementId?: string): Promise<boolean> {
    if (customMeasurementId) {
      this.measurementId = customMeasurementId;
    }

    if (this.isInitialized) {
      return true;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.isInitialized = true;
      return true;
    }

    try {
      if (this.measurementId) {
        // 1. Setup window.dataLayer and window.gtag
        window.dataLayer = window.dataLayer || [];
        if (!window.gtag) {
          window.gtag = function gtag(...args: unknown[]) {
            window.dataLayer?.push(args);
          };
        }

        // Initialize gtag config
        window.gtag('js', new Date());
        window.gtag('config', this.measurementId, {
          send_page_view: false, // Handled manually for SPA routing
          app_name: 'BudmoBarFinder',
          app_version: '1.0.0',
        });

        // 2. Inject official Google tag (gtag.js) script if not already present
        const scriptId = 'google-analytics-gtag';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
          document.head.appendChild(script);
        }

        console.log(`[Analytics] Google Analytics (GA4) initialized with ID: ${this.measurementId}`);
      }

      // 3. Attempt Firebase Analytics initialization only when configured with a valid measurementId
      const fbMeasurementId = (firebaseConfig as { measurementId?: string }).measurementId;
      if (fbMeasurementId && /^G-[A-Z0-9]+$/i.test(fbMeasurementId)) {
        try {
          const { isSupported, getAnalytics } = await import('firebase/analytics');
          const supported = await isSupported();
          if (supported && firebaseApp) {
            this.firebaseAnalyticsInstance = getAnalytics(firebaseApp);
            console.log('[Analytics] Firebase Analytics successfully initialized');
          }
        } catch (fbErr) {
          // Non-blocking fallback if IndexedDB/cookies restricted or remote config not linked
          console.info('[Analytics] Firebase Analytics optional module bypassed:', fbErr);
        }
      }

      this.isInitialized = true;

      // Log initial session start event
      this.trackEvent('app_initialized', {
        measurement_id: this.measurementId || 'unconfigured',
        user_agent: navigator.userAgent,
        screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
      });

      return true;
    } catch (err) {
      console.warn('[Analytics] Failed to initialize Google Analytics:', err);
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Log an event to Google Analytics (gtag.js) & Firebase Analytics
   */
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    const timestamp = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const eventEntry: AnalyticsEventEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp,
      name: eventName,
      params,
    };

    // Store in local ring buffer
    this.recentEvents.unshift(eventEntry);
    if (this.recentEvents.length > this.MAX_EVENTS_HISTORY) {
      this.recentEvents.pop();
    }

    // Forward to gtag
    if (typeof window !== 'undefined' && window.gtag) {
      try {
        window.gtag('event', eventName, params);
      } catch (e) {
        console.warn('[Analytics] gtag event dispatch error:', e);
      }
    }

    // Forward to Firebase Analytics if initialized
    if (this.firebaseAnalyticsInstance) {
      import('firebase/analytics').then(({ logEvent }) => {
        try {
          logEvent(this.firebaseAnalyticsInstance as never, eventName, params);
        } catch (e) {
          console.warn('[Analytics] Firebase logEvent error:', e);
        }
      }).catch(() => {
        // silent
      });
    }

    // Notify local subscribers (UI debug telemetry)
    this.notifyListeners(eventEntry);
  }

  /**
   * Track SPA screen/page view
   */
  trackPageView(pageTitle: string, pageLocation?: string): void {
    const location = pageLocation || (typeof window !== 'undefined' ? window.location.pathname : '/');
    this.trackEvent('page_view', {
      page_title: pageTitle,
      page_location: location,
    });
  }

  /**
   * Track tab switching in the mobile interface
   */
  trackTabSwitch(fromTab: string, toTab: string): void {
    this.trackEvent('tab_switched', {
      previous_tab: fromTab,
      active_tab: toTab,
      event_category: 'navigation',
    });
  }

  /**
   * Track venue interactions (detail view, map navigation, directions)
   */
  trackVenueView(venueId: string, venueName: string, category?: string): void {
    this.trackEvent('select_content', {
      content_type: 'venue',
      item_id: venueId,
      item_name: venueName,
      item_category: category,
      event_category: 'venues',
    });
  }

  /**
   * Track adding/removing a venue from favorites
   */
  trackVenueFavorite(venueId: string, venueName: string, isFavorite: boolean): void {
    this.trackEvent(isFavorite ? 'add_to_wishlist' : 'remove_from_wishlist', {
      item_id: venueId,
      item_name: venueName,
      content_type: 'venue_favorite',
      event_category: 'venues',
    });
  }

  /**
   * Track Group Meetup actions (create, join, leave, invite, calendar export, check_in)
   */
  trackMeetupAction(
    action: 'create' | 'join' | 'leave' | 'invite' | 'calendar_sync' | 'view' | 'check_in',
    meetupId?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.trackEvent(`meetup_${action}`, {
      meetup_id: meetupId || 'unknown',
      event_category: 'meetups',
      ...metadata,
    });
  }

  /**
   * Track Friends system interactions
   */
  trackFriendAction(
    action: 'send_request' | 'accept_request' | 'reject_request' | 'remove_friend' | 'view_list',
    targetUserId?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.trackEvent(`friend_${action}`, {
      target_user_id: targetUserId,
      event_category: 'social',
      ...metadata,
    });
  }

  /**
   * Track Battery Saver toggle
   */
  trackBatterySaver(enabled: boolean): void {
    this.trackEvent('battery_saver_toggle', {
      enabled,
      mode: enabled ? 'low_power_90s' : 'standard_high_accuracy_15s',
      event_category: 'settings',
    });
  }

  /**
   * Track language switch
   */
  trackLanguageChange(language: string, mode: 'auto_geo' | 'manual' = 'manual'): void {
    this.trackEvent('change_language', {
      language,
      selection_mode: mode,
      event_category: 'localization',
    });
  }

  /**
   * Track search queries and filters
   */
  trackSearch(searchTerm: string, resultsCount: number, category?: string): void {
    this.trackEvent('search', {
      search_term: searchTerm,
      results_count: resultsCount,
      search_category: category || 'all',
      event_category: 'discovery',
    });
  }

  /**
   * Track SOS emergency actions
   */
  trackSosTrigger(action: 'open_modal' | 'call_angela' | 'call_112' | 'copy_address'): void {
    this.trackEvent('sos_emergency_action', {
      action_type: action,
      event_category: 'safety',
      event_level: 'critical',
    });
  }

  /**
   * Set user ID and custom dimensions
   */
  setUser(userId: string | null, properties?: Record<string, unknown>): void {
    if (typeof window !== 'undefined' && window.gtag) {
      if (userId) {
        window.gtag('set', 'user_properties', {
          user_id: userId,
          ...properties,
        });
        window.gtag('config', this.measurementId, {
          user_id: userId,
        });
      }
    }

    if (this.firebaseAnalyticsInstance && userId) {
      import('firebase/analytics').then(({ setUserId, setUserProperties }) => {
        try {
          setUserId(this.firebaseAnalyticsInstance as never, userId);
          if (properties) {
            setUserProperties(this.firebaseAnalyticsInstance as never, properties as Record<string, string>);
          }
        } catch (e) {
          console.warn('[Analytics] Firebase setUserId error:', e);
        }
      }).catch(() => {});
    }

    this.trackEvent('user_identified', {
      user_id: userId || 'guest',
      ...properties,
    });
  }

  /**
   * Get active measurement ID
   */
  getMeasurementId(): string {
    return this.measurementId;
  }

  /**
   * Returns list of recently tracked events (for debugging & telemetry display)
   */
  getRecentEvents(): AnalyticsEventEntry[] {
    return [...this.recentEvents];
  }

  /**
   * Alias for getRecentEvents for compatibility
   */
  getBufferedEvents(): AnalyticsEventEntry[] {
    return this.getRecentEvents();
  }

  /**
   * Subscribe to real-time tracked events
   */
  subscribe(callback: (event: AnalyticsEventEntry, allEvents: AnalyticsEventEntry[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: AnalyticsEventEntry) {
    const all = [...this.recentEvents];
    this.listeners.forEach((callback) => {
      try {
        callback(event, all);
      } catch (err) {
        console.error('Error in analytics listener:', err);
      }
    });
  }
}

export const analyticsService = new AnalyticsService();
