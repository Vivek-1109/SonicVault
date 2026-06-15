import { StyleSheet, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const typography = StyleSheet.create({
  h1: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    fontFamily,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily,
  },
});
