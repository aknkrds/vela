import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';

interface AdBannerProps {
  placement?: 'home' | 'messages' | 'inline';
}

// Google AdMob Account Publisher ID
export const ADMOB_PUBLISHER_ID = 'ca-app-pub-7959716978040392';

// Google AdMob Standard Banner Unit IDs (Replace with specific Ad Unit IDs from AdMob console when live)
export const ADMOB_BANNER_ID_ANDROID = 'ca-app-pub-7959716978040392/6300978111';
export const ADMOB_BANNER_ID_IOS = 'ca-app-pub-7959716978040392/2934735716';

export default function AdBanner({ placement = 'home' }: AdBannerProps) {
  const { user } = useAuth();
  const { colors, fontSizeScale } = useSettings();

  // Show ads ONLY for free and basic tier users
  const tier = (user?.subscription_tier || 'free').toLowerCase();
  const showAd = tier === 'free' || tier === 'basic';

  if (!showAd) {
    return null;
  }

  return (
    <View style={[styles.adContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.adHeader}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>Sponsorlu Reklam</Text>
        </View>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
      </View>
      <View style={styles.adContent}>
        <Ionicons name="sparkles" size={24} color={colors.accent} style={{ marginRight: 12 }} />
        <View style={styles.adTextWrapper}>
          <Text style={[styles.adTitle, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>
            Vela VIP Üyelik Fırsatları
          </Text>
          <Text style={[styles.adDescription, { fontSize: 12 * fontSizeScale, color: colors.textSecondary }]}>
            Sesli ve video mesaj hakkı kazanmak için Ömür Boyu pakete yükseltin.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adBadge: {
    backgroundColor: '#3b82f620',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  adContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adTextWrapper: {
    flex: 1,
  },
  adTitle: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  adDescription: {
    lineHeight: 16,
  },
});
