import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

export const ADMOB_PUBLISHER_ID = 'ca-app-pub-7959716978040392';

// Google Official Test Ad Unit IDs (for development/testing only)
const GOOGLE_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const GOOGLE_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

// Banner Live Unit IDs
export const ADMOB_BANNER_ID_ANDROID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || 'ca-app-pub-7959716978040392/6300978111';
export const ADMOB_BANNER_ID_IOS = process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || 'ca-app-pub-7959716978040392/2934735716';

// Interstitial Live Unit IDs
export const ADMOB_INTERSTITIAL_ID_ANDROID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || 'ca-app-pub-7959716978040392/1033173712';
export const ADMOB_INTERSTITIAL_ID_IOS = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || 'ca-app-pub-7959716978040392/2934735716';

let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;
let interstitialInstance: any = null;
let isLoaded = false;

try {
  if (!isRunningInExpoGo() && Platform.OS !== 'web') {
    const mobileAds = require('react-native-google-mobile-ads');
    InterstitialAd = mobileAds.InterstitialAd;
    AdEventType = mobileAds.AdEventType;
    TestIds = mobileAds.TestIds;
  }
} catch (e) {
  // Mobile ads not available in current runtime environment
}

export function getBannerAdUnitId(): string {
  if (__DEV__) {
    // Always use Google official test IDs in development mode
    return TestIds?.BANNER || GOOGLE_TEST_BANNER_ID;
  }
  return Platform.OS === 'ios' ? ADMOB_BANNER_ID_IOS : ADMOB_BANNER_ID_ANDROID;
}

export function getInterstitialAdUnitId(): string {
  if (__DEV__) {
    // Always use Google official test IDs in development mode
    return TestIds?.INTERSTITIAL || GOOGLE_TEST_INTERSTITIAL_ID;
  }
  return Platform.OS === 'ios' ? ADMOB_INTERSTITIAL_ID_IOS : ADMOB_INTERSTITIAL_ID_ANDROID;
}

/**
 * Preload Interstitial Ad ONLY for free tier users
 */
export function preloadInterstitialAd(userTier?: string) {
  const tier = (userTier || 'free').toLowerCase();
  if (tier !== 'free') {
    // Strictly do NOT load ads for paid tier users
    return;
  }

  if (!InterstitialAd) return;

  try {
    const adUnitId = getInterstitialAdUnitId();
    interstitialInstance = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitialInstance.addAdEventListener(AdEventType.LOADED, () => {
      isLoaded = true;
    });

    interstitialInstance.addAdEventListener(AdEventType.CLOSED, () => {
      isLoaded = false;
      preloadInterstitialAd(userTier);
    });

    interstitialInstance.load();
  } catch (err) {
    console.warn('AdMob Interstitial preload error:', err);
  }
}

/**
 * Show Interstitial Ad ONLY for free tier users
 */
export function showInterstitialAd(userTier?: string) {
  const tier = (userTier || 'free').toLowerCase();
  if (tier !== 'free') {
    // Paid plan users never see ads
    return Promise.resolve();
  }

  if (interstitialInstance && isLoaded) {
    try {
      interstitialInstance.show();
    } catch (e) {
      console.warn('Failed to show Interstitial Ad:', e);
    }
  } else {
    preloadInterstitialAd(userTier);
  }
  return Promise.resolve();
}
