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
    if (Platform.OS === 'android') {
      if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes('placeholder')) {
        // RevenueCat key not configured — skip native SDK init
        return;
      }
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: GOOGLE_API_KEY, appUserID: userId });
    } else if (Platform.OS === 'ios') {
      if (!APPLE_API_KEY || APPLE_API_KEY.includes('placeholder')) {
        // RevenueCat key not configured — skip native SDK init
        return;
      }
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: APPLE_API_KEY, appUserID: userId });
    } else {
      return;
    }
  } catch (error) {
    // Expected to fail in Expo Go without native build
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
    throw error;
  }
};
