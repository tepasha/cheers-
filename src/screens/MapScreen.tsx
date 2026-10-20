import { dialogs as Alert } from '../services/dialogs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Circle, MapView, Marker, type Region } from '../components/map';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, IconButton, Row } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectBuddies, selectHangouts, selectLocation } from '../store/selectors';
import { locationUpdated } from '../store/slices/locationSlice';
import { joinHangout, openDirectChat } from '../store/thunks/social';
import { removeFavoriteVenue, saveFavoriteVenue } from '../store/thunks/favorites';
import { CATEGORY_CONFIG, GOOGLE_MAPS_VENUES, VenuePlace } from '../data/venuesData';
import { PLACE_KIND_CONFIG, mergePlaces, placesQueryFor, shouldRefetchPlaces, withoutCurated, type PlaceVenue, type PlacesQuery } from '../logic/places';
import { fetchNearbyPlaces } from '../services/placesService';
import { formatDistance, calculateDistanceKm } from '../services/geoService';
import { requestDeviceLocation } from '../services/locationService';
import { analyticsService } from '../services/analyticsService';
import { BuddyProfile, HangoutAlert } from '../types';
import { useTr } from '../hooks/useT';
import { useFocusDemand } from '../hooks/useFocusDemand';

type Selection =
  | { kind: 'venue'; venue: VenuePlace }
  | { kind: 'place'; place: PlaceVenue }
  | { kind: 'buddy'; buddy: BuddyProfile }
  | { kind: 'hangout'; hangout: HangoutAlert };

const regionFor = (lat: number, lng: number): Region => ({ latitude: lat, longitude: lng, latitudeDelta: 0.03, longitudeDelta: 0.03 });

export const MapScreen = () => {
  const tr = useTr();
  // The map shows people, tables and the position itself, which is the one place precise GPS is worth its battery
  useFocusDemand('people');
  useFocusDemand('feeds');
  useFocusDemand('preciseLocation');
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const location = useAppSelector(selectLocation);
  const buddies = useAppSelector(selectBuddies);
  const hangouts = useAppSelector(selectHangouts);
  const favorites = useAppSelector((s) => s.favorites.items);
  const userId = useAppSelector((s) => s.auth.user.id);
  const [selected, setSelection] = useState<Selection | null>(null);
  const currentHangout = selected?.kind === 'hangout' ? hangouts.find((h) => h.id === selected.hangout.id) : undefined;
  const selection: Selection | null = selected?.kind === 'hangout' ? (currentHangout ? { kind: 'hangout', hangout: currentHangout } : null) : selected;
  const [locating, setLocating] = useState(false);
  const language = useAppSelector((s) => s.settings.language);

  // Bars, pubs and restaurants from Google Places, for this session only (see logic/places.ts)
  const [places, setPlaces] = useState<PlaceVenue[]>([]);
  const lastPlacesQuery = useRef<PlacesQuery | null>(null);
  const placesInFlight = useRef(false);
  const pendingPlacesQuery = useRef<PlacesQuery | null>(null);
  const loadPlaces = useCallback(
    async (query: PlacesQuery) => {
      // One request at a time; the map's latest area waits and is asked right after
      if (placesInFlight.current) {
        pendingPlacesQuery.current = query;
        return;
      }
      placesInFlight.current = true;
      for (let next: PlacesQuery | null = query; next; next = pendingPlacesQuery.current, pendingPlacesQuery.current = null) {
        if (!shouldRefetchPlaces(lastPlacesQuery.current, next)) continue;
        try {
          const fresh = await fetchNearbyPlaces(next, language);
          lastPlacesQuery.current = next;
          setPlaces((kept) => mergePlaces(kept, fresh));
        } catch (err) {
          // Extra pins only: the curated venues, people and tables stay, so no error screen (rate limit included)
          console.warn('Could not load places nearby:', err);
        }
      }
      placesInFlight.current = false;
    },
    [language]
  );
  const initialCenter = useRef(location);
  useEffect(() => {
    void loadPlaces(placesQueryFor(regionFor(initialCenter.current.lat, initialCenter.current.lng)));
  }, [loadPlaces]);
  const visiblePlaces = useMemo(() => withoutCurated(places, GOOGLE_MAPS_VENUES), [places]);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const goTo = useCallback((lat: number, lng: number) => mapRef.current?.animateToRegion(regionFor(lat, lng), 500), []);

  const useGps = async () => {
    setLocating(true);
    const real = await requestDeviceLocation();
    setLocating(false);
    if (!real) {
      Alert.error(tr('Дозвольте доступ до місцезнаходження в налаштуваннях пристрою або оберіть район зі списку.'));
      return;
    }
    dispatch(locationUpdated(real));
    goTo(real.lat, real.lng);
  };

  const select = (s: Selection) => {
    setSelection(s);
    if (s.kind === 'venue') analyticsService.trackVenueView(s.venue.id, s.venue.name, s.venue.category);
    if (s.kind === 'place') analyticsService.trackVenueView(s.place.id, s.place.name, s.place.kind);
  };

  const togglePlaceFavorite = (p: PlaceVenue) => {
    if (favoriteIds.has(p.id)) dispatch(removeFavoriteVenue(p.id));
    else dispatch(saveFavoriteVenue({ id: p.id, name: p.name, area: p.address, category: PLACE_KIND_CONFIG[p.kind].label, lat: p.lat, lng: p.lng }));
  };

  const toggleFavorite = (v: VenuePlace) => {
    if (favoriteIds.has(v.id)) dispatch(removeFavoriteVenue(v.id));
    else
      dispatch(
        saveFavoriteVenue({ id: v.id, name: v.name, area: v.address, category: v.categoryLabel, lat: v.lat, lng: v.lng })
      );
  };

  const openChat = (b: BuddyProfile) => navigation.navigate('ChatRoom', { chatId: dispatch(openDirectChat(b)) });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader
        title={tr('Мапа')}
        right={<IconButton icon="crosshair" label={tr('Моя геолокація')} active={!location.isSimulated} onPress={useGps} />}
      />

      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFor(location.lat, location.lng)}
          userInterfaceStyle="dark"
          showsCompass={false}
          onPress={() => setSelection(null)}
          onRegionChangeComplete={(region) => void loadPlaces(placesQueryFor(region))}
          toolbarEnabled={false}
        >
          <Circle center={{ latitude: location.lat, longitude: location.lng }} radius={Math.max(location.accuracyMeters, 25)} strokeColor={colors.amber} fillColor="rgba(245,158,11,0.18)" />
          <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} title={tr('Ви тут')} pinColor="blue" tracksViewChanges={false} />

          {GOOGLE_MAPS_VENUES.map((v) => (
            <VenueMarker key={v.id} name={v.name} lat={v.lat} lng={v.lng} color={CATEGORY_CONFIG[v.category].pinColor} onPress={() => select({ kind: 'venue', venue: v })} />
          ))}

          {visiblePlaces.map((p) => (
            <VenueMarker key={`p-${p.id}`} name={p.name} lat={p.lat} lng={p.lng} color={PLACE_KIND_CONFIG[p.kind].pinColor} onPress={() => select({ kind: 'place', place: p })} />
          ))}

          {buddies.map((b) => (
            <Marker
              key={`b-${b.id}`}
              identifier={b.name}
              coordinate={{ latitude: b.coordinates.lat, longitude: b.coordinates.lng }}
              pinColor="green"
              onPress={(e) => {
                e.stopPropagation();
                select({ kind: 'buddy', buddy: b });
              }}
              tracksViewChanges={false}
            />
          ))}

          {hangouts.map(
            (h) =>
              typeof h.lat === 'number' &&
              typeof h.lng === 'number' && (
                <Marker
                  key={`h-${h.id}`}
                  identifier={h.barName}
                  coordinate={{ latitude: h.lat, longitude: h.lng }}
                  pinColor="orange"
                  onPress={(e) => {
                    e.stopPropagation();
                    select({ kind: 'hangout', hangout: h });
                  }}
                  tracksViewChanges={false}
                />
              )
          )}
        </MapView>

        {selection && (
          <View style={styles.detail} pointerEvents="box-none">
            <Card style={{ gap: spacing.sm }}>
              {selection.kind === 'venue' && (
                <VenueDetail
                  venue={selection.venue}
                  distanceKm={calculateDistanceKm(location.lat, location.lng, selection.venue.lat, selection.venue.lng)}
                  isFavorite={favoriteIds.has(selection.venue.id)}
                  onToggleFavorite={() => toggleFavorite(selection.venue)}
                />
              )}
              {selection.kind === 'place' && (
                <PlaceDetail
                  place={selection.place}
                  distanceKm={calculateDistanceKm(location.lat, location.lng, selection.place.lat, selection.place.lng)}
                  isFavorite={favoriteIds.has(selection.place.id)}
                  onToggleFavorite={() => togglePlaceFavorite(selection.place)}
                />
              )}
              {selection.kind === 'buddy' && (
                <>
                  <Row style={{ gap: spacing.md }}>
                    <Avatar uri={selection.buddy.avatar} name={selection.buddy.name} size={48} online={selection.buddy.online} />
                    <View style={{ flex: 1 }}>
                      <Text style={typography.heading}>
                        {selection.buddy.name}, {selection.buddy.age}
                      </Text>
                      <Text style={typography.small}>
                        {formatDistance(selection.buddy.distanceKm)}
                      </Text>
                    </View>
                  </Row>
                  <Button label={tr('Написати')} icon="message-circle" small onPress={() => openChat(selection.buddy)} />
                </>
              )}
              {selection.kind === 'hangout' && (
                <>
                  <Text style={typography.heading}>🍻 {selection.hangout.barName}</Text>
                  <Text style={typography.small}>
                    {selection.hangout.userName} • {tr(selection.hangout.drinkPreference)}
                    {selection.hangout.distanceFormatted ? ` • ${selection.hangout.distanceFormatted}` : ''}
                  </Text>
                  {!!selection.hangout.description && <Text style={typography.body}>{selection.hangout.description}</Text>}
                  <Button
                    label={selection.hangout.userId === userId || (selection.hangout.joinedUsers ?? []).includes(userId) ? tr('Ви за столиком') : tr('Приєднатись')}
                    icon="log-in"
                    small
                    disabled={selection.hangout.userId === userId || (selection.hangout.joinedUsers ?? []).includes(userId) || selection.hangout.participantsCount >= selection.hangout.slotsAvailable + 1}
                    onPress={() => dispatch(joinHangout(selection.hangout.id))}
                  />
                </>
              )}
            </Card>
          </View>
        )}

        {locating && (
          <View style={styles.locating}>
            <Badge label={tr('Визначаємо позицію…')} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const VenueDetail = ({
  venue,
  distanceKm,
  isFavorite,
  onToggleFavorite,
}: {
  venue: VenuePlace;
  distanceKm: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) => {
  const tr = useTr();
  return (
  <>
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Text style={typography.heading}>
          {CATEGORY_CONFIG[venue.category].icon} {venue.name}
        </Text>
        <Text style={typography.small}>
          {venue.categoryLabel} • ⭐ {venue.rating} ({venue.reviewCount}) • {venue.priceTier}
        </Text>
      </View>
      <IconButton icon={isFavorite ? 'heart' : 'heart'} label={isFavorite ? tr('Прибрати з улюблених') : tr('В улюблені')} color={isFavorite ? colors.red : colors.textDim} onPress={onToggleFavorite} />
    </Row>
    <Text style={typography.small}>
      📍 {venue.address} • {formatDistance(distanceKm)} • 🕒 {venue.openingHours}
    </Text>
    <Text style={typography.body}>{venue.description}</Text>
    <Text style={typography.tiny}>🍺 {venue.popularDrinks.join(' • ')}</Text>
    <Button label={tr('Відкрити в Google Maps')} icon="external-link" small variant="secondary" onPress={() => Linking.openURL(venue.googleMapsUrl)} />
  </>
);
};

/**
 * Bars, pubs and restaurants: a drop half the size of the standard pin that tables, people and "you are here" keep,
 * so venues do not drown out the tables. Android draws the view into a bitmap once; it is tracked for a moment first
 * so that bitmap is not taken before the first layout (an empty marker).
 */
const VenueMarker = ({ name, lat, lng, color, onPress }: { name: string; lat: number; lng: number; color: string; onPress: () => void }) => {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracking(false), 500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Marker
      identifier={name}
      coordinate={{ latitude: lat, longitude: lng }}
      pinColor={color}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracking}
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <View style={styles.pinBox}>
        <View style={[styles.pinDrop, { backgroundColor: color }]}>
          <View style={styles.pinDot} />
        </View>
      </View>
    </Marker>
  );
};

/** A bar, pub or restaurant from Google Places; the credit line covers the web list, which is not a Google map */
const PlaceDetail = ({
  place,
  distanceKm,
  isFavorite,
  onToggleFavorite,
}: {
  place: PlaceVenue;
  distanceKm: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) => {
  const tr = useTr();
  const kind = PLACE_KIND_CONFIG[place.kind];
  const facts = [
    tr(kind.label),
    place.rating !== undefined ? `⭐ ${place.rating}${place.ratingCount !== undefined ? ` (${place.ratingCount})` : ''}` : null,
    place.openNow === undefined ? null : place.openNow ? tr('Відчинено') : tr('Зачинено'),
  ].filter(Boolean);
  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={typography.heading}>
            {kind.icon} {place.name}
          </Text>
          <Text style={typography.small}>{facts.join(' • ')}</Text>
        </View>
        <IconButton icon="heart" label={isFavorite ? tr('Прибрати з улюблених') : tr('В улюблені')} color={isFavorite ? colors.red : colors.textDim} onPress={onToggleFavorite} />
      </Row>
      <Text style={typography.small}>
        📍 {place.address ? `${place.address} • ` : ''}{formatDistance(distanceKm)}
      </Text>
      <Button label={tr('Відкрити в Google Maps')} icon="external-link" small variant="secondary" onPress={() => Linking.openURL(place.mapsUrl)} />
      <Text style={typography.tiny}>{tr('Дані: Google Maps')}</Text>
    </>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // About 14×20 dp against the standard pin's 27×39: a rounded square turned 45° so its sharp corner points down
  pinBox: { width: 16, height: 21, alignItems: 'center' },
  pinDrop: {
    width: 14,
    height: 14,
    marginTop: 4,
    borderRadius: 7,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(0,0,0,0.45)' },
  detail: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  locating: { position: 'absolute', top: spacing.md, alignSelf: 'center', borderRadius: radius.pill },
});
