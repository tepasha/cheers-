import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useTr } from '../../hooks/useT';

/**
 * Browser stand-in for react-native-maps (which needs native SDKs). It keeps the screen usable: the markers become a
 * list, and tapping one selects it exactly as tapping a pin does on a phone. The real map is in the mobile app.
 * Same surface as the native module: MapView, Marker, Circle, Region.
 */
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MapViewProps {
  style?: unknown;
  initialRegion?: Region;
  onPress?: () => void;
  children?: React.ReactNode;
  // Accepted and ignored so MapScreen compiles against both implementations
  userInterfaceStyle?: string;
  showsCompass?: boolean;
  toolbarEnabled?: boolean;
}

const MapNotice = ({ onPress }: { onPress?: () => void }) => {
  const tr = useTr();
  return (
    <Pressable onPress={onPress} style={styles.notice} accessibilityRole="button">
      <Text style={typography.small}>{tr('🗺️ Інтерактивна мапа доступна в мобільному застосунку (iOS / Android). Нижче: точки поруч.')}</Text>
    </Pressable>
  );
};

export class MapView extends React.Component<MapViewProps> {
  animateToRegion(_region: Region, _duration?: number): void {
    // nothing to animate in the list view
  }

  render() {
    return (
      <View style={styles.root}>
        <MapNotice onPress={this.props.onPress} />
        <ScrollView contentContainerStyle={styles.list}>{this.props.children}</ScrollView>
      </View>
    );
  }
}

const PIN_COLORS: Record<string, string> = { blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b', red: '#ef4444', violet: '#8b5cf6', purple: '#8b5cf6', yellow: '#eab308' };

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  pinColor?: string;
  title?: string;
  /** The label shown in the list; also accepted by react-native-maps, where it is not visible */
  identifier?: string;
  tracksViewChanges?: boolean;
  onPress?: (event: { stopPropagation: () => void }) => void;
}

export const Marker = ({ coordinate, pinColor = 'red', title, identifier, onPress }: MarkerProps) => {
  const tr = useTr();
  return (
    <Pressable accessibilityRole="button" onPress={() => onPress?.({ stopPropagation: () => {} })} style={styles.row}>
      <View style={[styles.dot, { backgroundColor: PIN_COLORS[pinColor] ?? colors.amber }]} />
      <View style={{ flex: 1 }}>
        <Text style={typography.body} numberOfLines={1}>
          {title || identifier || tr('Точка на мапі')}
        </Text>
        <Text style={typography.tiny}>
          {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
        </Text>
      </View>
    </Pressable>
  );
};

/** The accuracy circle has no list equivalent */
export const Circle = (_props: Record<string, unknown>) => null;

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
  notice: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  list: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
