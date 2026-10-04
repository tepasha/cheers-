import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, MapView, Marker, type Region } from '../components/map';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme';
import { Avatar, Badge, Button, Card, Chip, IconButton, Row } from '../components/ui';
import { OfflineBanner, ScreenHeader } from '../components/shell';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectBuddies, selectHangouts, selectLocation } from '../store/selectors';
import { locationUpdated } from '../store/slices/locationSlice';
import { joinHangout, openDirectChat } from '../store/thunks/social';
import { removeFavoriteVenue, saveFavoriteVenue } from '../store/thunks/favorites';
import { CATEGORY_CONFIG, GOOGLE_MAPS_VENUES, VenuePlace } from '../data/venuesData';
import { PRESET_LOCATIONS, PresetLocation, formatDistance, calculateDistanceKm } from '../services/geoService';
import { requestDeviceLocation } from '../services/locationService';
import { formatClock } from '../utils/time';
import { analyticsService } from '../services/analyticsService';
import { BuddyProfile, HangoutAlert } from '../types';
import { useTr } from '../hooks/useT';

type Selection =
  | { kind: 'venue'; venue: VenuePlace }
  | { kind: 'buddy'; buddy: BuddyProfile }
  | { kind: 'hangout'; hangout: HangoutAlert };

const regionFor = (lat: number, lng: number): Region => ({ latitude: lat, longitude: lng, latitudeDelta: 0.03, longitudeDelta: 0.03 });

export const MapScreen = () => {
  const tr = useTr();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const location = useAppSelector(selectLocation);
  const buddies = useAppSelector(selectBuddies);
  const hangouts = useAppSelector(selectHangouts);
  const favorites = useAppSelector((s) => s.favorites.items);
  const userId = useAppSelector((s) => s.auth.user.id);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [locating, setLocating] = useState(false);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const goTo = useCallback((lat: number, lng: number) => mapRef.current?.animateToRegion(regionFor(lat, lng), 500), []);

  const pickPreset = (p: PresetLocation) => {
    dispatch(
      locationUpdated({
        lat: p.lat,
        lng: p.lng,
        locationName: p.name,
        accuracyMeters: 10,
        lastUpdated: formatClock(),
        isSimulated: true,
        status: 'active',
      })
    );
    goTo(p.lat, p.lng);
  };

  const useGps = async () => {
    setLocating(true);
    const real = await requestDeviceLocation();
    setLocating(false);
    if (!real) {
      Alert.alert(tr('Немає доступу до геолокації'), tr('Дозвольте доступ до місцезнаходження в налаштуваннях пристрою або оберіть район зі списку.'));
      return;
    }
    dispatch(locationUpdated(real));
    goTo(real.lat, real.lng);
  };

  const select = (s: Selection) => {
    setSelection(s);
    if (s.kind === 'venue') analyticsService.trackVenueView(s.venue.id, s.venue.name, s.venue.category);
  };

  const toggleFavorite = (v: VenuePlace) => {
    if (favoriteIds.has(v.id)) dispatch(removeFavoriteVenue(v.id));
    else
      dispatch(
        saveFavoriteVenue({ id: v.id, name: v.name, area: `${v.cityName}, ${v.district}`, category: v.categoryLabel, lat: v.lat, lng: v.lng })
      );
  };

  const openChat = (b: BuddyProfile) => navigation.navigate('ChatRoom', { chatId: dispatch(openDirectChat(b)) });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader
        title={tr('Мапа')}
        subtitle={location.isSimulated ? tr(location.locationName) : `📡 ${tr(location.locationName)}`}
        right={<IconButton icon="crosshair" label={tr('Моя геолокація')} active={!location.isSimulated} onPress={useGps} />}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.presets}>
        {PRESET_LOCATIONS.map((p) => (
          <Chip key={p.id} label={p.name} selected={location.isSimulated && location.locationName === p.name} onPress={() => pickPreset(p)} />
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFor(location.lat, location.lng)}
          userInterfaceStyle="dark"
          showsCompass={false}
          onPress={() => setSelection(null)}
          toolbarEnabled={false}
        >
          <Circle center={{ latitude: location.lat, longitude: location.lng }} radius={Math.max(location.accuracyMeters, 25)} strokeColor={colors.amber} fillColor="rgba(245,158,11,0.18)" />
          <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} title={tr('Ви тут')} pinColor="blue" tracksViewChanges={false} />

          {GOOGLE_MAPS_VENUES.map((v) => (
            <Marker
              key={v.id}
              identifier={v.name}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              pinColor={CATEGORY_CONFIG[v.category].pinColor}
              onPress={(e) => {
                e.stopPropagation();
                select({ kind: 'venue', venue: v });
              }}
              tracksViewChanges={false}
            />
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
              {selection.kind === 'buddy' && (
                <>
                  <Row style={{ gap: spacing.md }}>
                    <Avatar uri={selection.buddy.avatar} name={selection.buddy.name} size={48} online={selection.buddy.online} />
                    <View style={{ flex: 1 }}>
                      <Text style={typography.heading}>
                        {selection.buddy.name}, {selection.buddy.age}
                      </Text>
                      <Text style={typography.small}>
                        {selection.buddy.locationName} • {formatDistance(selection.buddy.distanceKm)}
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
                    disabled={selection.hangout.userId === userId || (selection.hangout.joinedUsers ?? []).includes(userId)}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  presets: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  detail: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  locating: { position: 'absolute', top: spacing.md, alignSelf: 'center', borderRadius: radius.pill },
});
