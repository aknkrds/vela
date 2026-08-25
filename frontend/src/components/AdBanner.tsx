import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { isRunningInExpoGo } from 'expo';
import { ADMOB_PUBLISHER_ID, ADMOB_BANNER_ID_ANDROID, ADMOB_BANNER_ID_IOS, getBannerAdUnitId } from '@/src/services/admob';

let BannerAd: any = null;
let BannerAdSize: any = null;

try {
  if (!isRunningInExpoGo() && Platform.OS !== 'web') {
    const mobileAds = require('react-native-google-mobile-ads');
    BannerAd = mobileAds.BannerAd;
    BannerAdSize = mobileAds.BannerAdSize;
  }
} catch (e) {
  // Mobile ads not available in current runtime environment
}

interface AdBannerProps {
  placement?: 'home' | 'messages' | 'inline';
}

export { ADMOB_PUBLISHER_ID, ADMOB_BANNER_ID_ANDROID, ADMOB_BANNER_ID_IOS };

export default function AdBanner({ placement = 'home' }: AdBannerProps) {
  const { user } = useAuth();
  const [adError, setAdError] = useState(false);

  // MUST ONLY show ads for 'free' tier users!
  // Paid plan users MUST NOT render any ad component at all!
  const tier = (user?.subscription_tier || 'free').toLowerCase();
  const isFreeUser = tier === 'free';

  if (!isFreeUser) {
    return null;
  }

  // If mobile ads native module is available and no error
  if (BannerAd && BannerAdSize && !adError) {
    const adUnitId = getBannerAdUnitId();
    return (
      <View style={styles.adContainer}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdFailedToLoad={(error: any) => {
            console.warn('AdMob Banner failed to load:', error);
            setAdError(true);
          }}
        />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    width: '100%',
  },
});
