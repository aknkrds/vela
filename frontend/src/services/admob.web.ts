export const ADMOB_PUBLISHER_ID = 'ca-app-pub-7959716978040392';
export const ADMOB_BANNER_ID_ANDROID = '';
export const ADMOB_BANNER_ID_IOS = '';
export const ADMOB_INTERSTITIAL_ID_ANDROID = '';
export const ADMOB_INTERSTITIAL_ID_IOS = '';

export function getBannerAdUnitId(): string {
  return '';
}

export function getInterstitialAdUnitId(): string {
  return '';
}

export function preloadInterstitialAd(userTier?: string) {
  // no-op on web
}

export function showInterstitialAd(userTier?: string): Promise<void> {
  return Promise.resolve();
}
