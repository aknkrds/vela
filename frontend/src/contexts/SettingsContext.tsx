import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { storage } from '@/src/utils/storage';
import { translations } from '../utils/translations';
import { getColors, ThemeColors, ThemeType, COMFORT_FONT_SCALE } from '../utils/theme';

interface SettingsContextType {
  language: 'en' | 'tr';
  fontSizeScale: number;
  theme: ThemeType;
  comfortMode: boolean;
  colors: ThemeColors;
  setLanguage: (lang: 'en' | 'tr') => Promise<void>;
  increaseFontScale: () => Promise<void>;
  decreaseFontScale: () => Promise<void>;
  resetFontScale: () => Promise<void>;
  setTheme: (theme: ThemeType) => Promise<void>;
  toggleComfortMode: () => Promise<void>;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<'en' | 'tr'>('en');
  const [fontSizeScale, setFontSizeScaleState] = useState<number>(1.0);
  const [theme, setThemeState] = useState<ThemeType>('dark');
  const [comfortMode, setComfortModeState] = useState<boolean>(false);

  // Memoize colors to avoid re-creating on every render
  const colors = useMemo(() => getColors(theme), [theme]);

  useEffect(() => {
    // Load persisted settings
    const loadSettings = async () => {
      const storedLang = await storage.getItem('app_language', 'en');
      const storedScale = await storage.getItem('app_font_scale', 1.0);
      const storedTheme = await storage.getItem('app_theme', 'dark');
      const storedComfort = await storage.getItem('app_comfort_mode', false);
      
      if (storedLang === 'en' || storedLang === 'tr') {
        setLanguageState(storedLang);
      }
      if (typeof storedScale === 'number') {
        setFontSizeScaleState(storedScale);
      }
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setThemeState(storedTheme);
      }
      if (typeof storedComfort === 'boolean') {
        setComfortModeState(storedComfort);
        // If comfort mode was on, ensure font scale is appropriate
        if (storedComfort && typeof storedScale === 'number' && storedScale < COMFORT_FONT_SCALE) {
          setFontSizeScaleState(COMFORT_FONT_SCALE);
        }
      }
    };
    loadSettings();
  }, []);

  const setLanguage = async (lang: 'en' | 'tr') => {
    setLanguageState(lang);
    await storage.setItem('app_language', lang);
  };

  const increaseFontScale = async () => {
    const newScale = parseFloat(Math.min(fontSizeScale + 0.1, 2.0).toFixed(1));
    setFontSizeScaleState(newScale);
    await storage.setItem('app_font_scale', newScale);
  };

  const decreaseFontScale = async () => {
    const minScale = comfortMode ? COMFORT_FONT_SCALE : 0.7;
    const newScale = parseFloat(Math.max(fontSizeScale - 0.1, minScale).toFixed(1));
    setFontSizeScaleState(newScale);
    await storage.setItem('app_font_scale', newScale);
  };

  const resetFontScale = async () => {
    const defaultScale = comfortMode ? COMFORT_FONT_SCALE : 1.0;
    setFontSizeScaleState(defaultScale);
    await storage.setItem('app_font_scale', defaultScale);
  };

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    await storage.setItem('app_theme', newTheme);
  };

  const toggleComfortMode = async () => {
    const newMode = !comfortMode;
    setComfortModeState(newMode);
    await storage.setItem('app_comfort_mode', newMode);

    if (newMode) {
      // Turning ON comfort mode: set font scale to comfort level if lower
      if (fontSizeScale < COMFORT_FONT_SCALE) {
        setFontSizeScaleState(COMFORT_FONT_SCALE);
        await storage.setItem('app_font_scale', COMFORT_FONT_SCALE);
      }
    } else {
      // Turning OFF comfort mode: reset font scale to normal
      setFontSizeScaleState(1.0);
      await storage.setItem('app_font_scale', 1.0);
    }
  };

  const t = (key: string): string => {
    const dict = translations[language];
    return dict[key] || key;
  };

  return (
    <SettingsContext.Provider value={{
      language, fontSizeScale, theme, comfortMode, colors,
      setLanguage, increaseFontScale, decreaseFontScale, resetFontScale,
      setTheme, toggleComfortMode, t
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
