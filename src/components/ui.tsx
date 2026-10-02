import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme';
import { useTr } from '../hooks/useT';

export type IconName = React.ComponentProps<typeof Feather>['name'];

export const Icon = ({ name, size = 18, color = colors.text }: { name: IconName; size?: number; color?: string }) => (
  <Feather name={name} size={size} color={color} />
);

// ─── Avatar ────────────────────────────────────────────────────────────────

export const Avatar = ({ uri, name, size = 44, online }: { uri?: string; name?: string; size?: number; online?: boolean }) => {
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHigh }} />
      ) : (
        <View
          style={[
            styles.avatarFallback,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={{ color: colors.onAmber, fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={[
            styles.presenceDot,
            { backgroundColor: online ? colors.green : colors.textDim, width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13 },
          ]}
        />
      )}
    </View>
  );
};

// ─── Buttons & chips ───────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const palette = {
    primary: { bg: colors.amber, fg: colors.onAmber, border: colors.amber },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    danger: { bg: colors.redBg, fg: colors.red, border: colors.red },
    ghost: { bg: 'transparent', fg: colors.amberSoft, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 14 : 16} color={palette.fg} />}
          <Text style={[styles.buttonLabel, small && { fontSize: 12 }, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

export const IconButton = ({
  icon,
  onPress,
  label,
  color = colors.text,
  badge,
  active,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  badge?: number;
  active?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    hitSlop={8}
    style={({ pressed }) => [styles.iconButton, active && { backgroundColor: colors.amberBg }, pressed && { opacity: 0.7 }]}
  >
    <Icon name={icon} size={20} color={active ? colors.amberSoft : color} />
    {!!badge && badge > 0 && (
      <View style={styles.iconBadge}>
        <Text style={styles.iconBadgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    )}
  </Pressable>
);

export const Chip = ({
  label,
  selected,
  onPress,
  emoji,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  emoji?: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    onPress={onPress}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    <Text style={[styles.chipText, selected && { color: colors.amberSoft }]}>
      {emoji ? `${emoji} ` : ''}
      {label}
    </Text>
  </Pressable>
);

export const Badge = ({ label, color = colors.amberSoft, bg = colors.amberBg }: { label: string; color?: string; bg?: string }) => (
  <View style={[styles.badge, { backgroundColor: bg }]}>
    <Text style={[styles.badgeText, { color }]}>{label}</Text>
  </View>
);

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <View style={styles.segment}>
    {options.map((o) => (
      <Pressable
        key={o.value}
        accessibilityRole="button"
        accessibilityState={{ selected: o.value === value }}
        onPress={() => onChange(o.value)}
        style={[styles.segmentItem, o.value === value && { backgroundColor: colors.amber }]}
      >
        <Text style={[styles.segmentText, o.value === value && { color: colors.onAmber }]}>{o.label}</Text>
      </Pressable>
    ))}
  </View>
);

// ─── Layout ────────────────────────────────────────────────────────────────

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={[typography.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>{String(children).toUpperCase()}</Text>
);

export const EmptyState = ({ emoji, title, subtitle, action }: { emoji: string; title: string; subtitle?: string; action?: React.ReactNode }) => (
  <View style={styles.empty}>
    <Text style={{ fontSize: 44 }}>{emoji}</Text>
    <Text style={[typography.heading, { textAlign: 'center' }]}>{title}</Text>
    {subtitle && <Text style={[typography.small, { textAlign: 'center' }]}>{subtitle}</Text>}
    {action}
  </View>
);

export const Row = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, style]}>{children}</View>
);

export const Field = ({ label, ...props }: { label: string } & TextInputProps) => (
  <View style={{ marginBottom: spacing.md }}>
    <Text style={[typography.label, { marginBottom: 6 }]}>{label}</Text>
    <TextInput
      placeholderTextColor={colors.textDim}
      {...props}
      style={[styles.input, props.multiline && { height: 84, textAlignVertical: 'top' }, props.style]}
    />
  </View>
);

// ─── Modal sheet ───────────────────────────────────────────────────────────

export const Sheet = ({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={tr('Закрити')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.sheetHeader}>
            <Text style={typography.heading}>{title}</Text>
            <IconButton icon="x" label={tr('Закрити')} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.md }}>
            {children}
          </ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  avatarFallback: { backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  presenceDot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2, borderColor: colors.bg },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: spacing.md },
  buttonLabel: { fontSize: 14, fontWeight: '700' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.amberBg, borderColor: colors.amber },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 10, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl * 1.5 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
