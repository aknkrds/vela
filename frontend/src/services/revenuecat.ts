import Purchases, { PurchasesOffering, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';
const APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '';

/**
 * Configure RevenueCat Purchases SDK for the current user
 * @param userId Unique user ID from MongoDB
 */
export const configurePurchases = async (userId: string) => {
  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    
    if (Platform.OS === 'android') {
      if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'goog_placeholder_api_key') {
        console.warn('RevenueCat Google API key is a placeholder or not set.');
      }
      Purchases.configure({ apiKey: GOOGLE_API_KEY, appUserID: userId });
    } else if (Platform.OS === 'ios') {
      if (!APPLE_API_KEY || APPLE_API_KEY === 'appl_placeholder_api_key') {
        console.warn('RevenueCat Apple API key is a placeholder or not set.');
      }
      Purchases.configure({ apiKey: APPLE_API_KEY, appUserID: userId });
    }
    console.log(`RevenueCat initialized successfully for user: ${userId}`);
  } catch (error) {
    console.error('Error configuring RevenueCat:', error);
  }
};

/**
 * Checks if the user has any active entitlements (subscriptions)
 */
export const getSubscriptionStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlements = customerInfo.entitlements.active;
    return Object.keys(entitlements).length > 0;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return false;
  }
};

/**
 * Retrieve current offerings configured in RevenueCat
 */
export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;
    }
    return null;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
};

/**
 * Purchase a selected package
 * @param purchasesPackage Package object from getOfferings()
 */
export const purchasePackage = async (purchasesPackage: any) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(purchasesPackage);
    return customerInfo;
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error('Error during package purchase:', error);
      throw error;
    }
    return null;
  }
};

/**
 * Restore user purchases
 */
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
};
