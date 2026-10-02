import { StyleSheet } from 'react-native';

/** Dark "night bar" palette (neutral + amber), matching the former Tailwind design */
export const colors = {
  bg: '#0a0a0a',
  surface: '#171717',
  surfaceHigh: '#262626',
  border: '#262626',
  borderSoft: '#1f1f1f',
  text: '#f5f5f5',
  textMuted: '#a3a3a3',
  textDim: '#737373',
  amber: '#f59e0b',
  amberSoft: '#fbbf24',
  amberBg: 'rgba(245, 158, 11, 0.15)',
  onAmber: '#0a0a0a',
  green: '#34d399',
  greenBg: 'rgba(52, 211, 153, 0.15)',
  red: '#f87171',
  redBg: 'rgba(248, 113, 113, 0.15)',
  blue: '#38bdf8',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const typography = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12, color: colors.textMuted },
  tiny: { fontSize: 10, color: colors.textDim },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
});
