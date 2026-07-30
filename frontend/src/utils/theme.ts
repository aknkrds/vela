// Theme color palettes for Vela app
// Dark theme = existing colors, Light theme = new complementary palette

export type ThemeType = 'dark' | 'light';

export interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceAlt: string; // Alternative surface (used for nested cards)
  
  // Borders
  border: string;
  borderLight: string;
  
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  
  // Accent (brand colors - same for both themes)
  accent: string;
  accentLight: string;
  accentDark: string;
  
  // Input
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  inputBorder: string;
  
  // Status colors
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  
  // Tab bar
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  
  // Modal
  modalOverlay: string;
  modalBg: string;
  
  // Google button
  googleBtnBg: string;
  googleBtnText: string;
  
  // Specific component colors
  iconColor: string;
  dividerLine: string;
  badgeBg: string;
}

const darkColors: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#0f172a',
  
  border: '#334155',
  borderLight: '#1e293b',
  
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentDark: '#312e81',
  
  inputBg: '#1e293b',
  inputText: '#ffffff',
  inputPlaceholder: '#64748b',
  inputBorder: '#334155',
  
  success: '#10b981',
  successBg: '#065f46',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  danger: '#ef4444',
  dangerBg: '#7f1d1d',
  
  tabBarBg: '#1e293b',
  tabBarBorder: '#334155',
  tabBarActive: '#6366f1',
  tabBarInactive: '#64748b',
  
  modalOverlay: 'rgba(0,0,0,0.8)',
  modalBg: '#0f172a',
  
  googleBtnBg: '#ffffff',
  googleBtnText: '#0f172a',
  
  iconColor: '#94a3b8',
  dividerLine: '#334155',
  badgeBg: '#334155',
};

const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentDark: '#eef2ff',
  
  inputBg: '#f1f5f9',
  inputText: '#0f172a',
  inputPlaceholder: '#94a3b8',
  inputBorder: '#e2e8f0',
  
  success: '#10b981',
  successBg: '#d1fae5',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.08)',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  
  tabBarBg: '#ffffff',
  tabBarBorder: '#e2e8f0',
  tabBarActive: '#6366f1',
  tabBarInactive: '#94a3b8',
  
  modalOverlay: 'rgba(0,0,0,0.5)',
  modalBg: '#ffffff',
  
  googleBtnBg: '#f1f5f9',
  googleBtnText: '#0f172a',
  
  iconColor: '#64748b',
  dividerLine: '#e2e8f0',
  badgeBg: '#e2e8f0',
};

export function getColors(theme: ThemeType): ThemeColors {
  return theme === 'dark' ? darkColors : lightColors;
}

// Comfort mode scaling factors
export const COMFORT_FONT_SCALE = 1.4;
export const COMFORT_BUTTON_HEIGHT = 68; // normal: 56
export const COMFORT_PADDING = 20;       // normal: 16
export const COMFORT_ICON_SIZE = 28;     // normal: 20-24
export const COMFORT_BORDER_RADIUS = 16; // normal: 12

import Constants from 'expo-constants';

// App Version
export const APP_VERSION = `v.${Constants.expoConfig?.version || '1.1.0'}`;

