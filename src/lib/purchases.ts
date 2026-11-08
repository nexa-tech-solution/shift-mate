import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { create } from 'zustand';

export const ENTITLEMENT = 'premium';

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
});

/**
 * Store purchases only work in a development/production build with a RevenueCat key.
 * Expo Go would run RevenueCat's preview mode, which fakes purchases — we refuse that.
 */
export const storeAvailable =
  !!apiKey && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && Platform.OS !== 'web';

interface PremiumState {
  isPremium: boolean;
  ready: boolean;
  packages: PurchasesPackage[];
  error?: string;
}

export const usePremium = create<PremiumState>(() => ({ isPremium: false, ready: false, packages: [] }));

const apply = (info: CustomerInfo) =>
  usePremium.setState({ isPremium: !!info.entitlements.active[ENTITLEMENT] });

let configured = false;
export async function initPurchases() {
  if (!storeAvailable || configured) {
    usePremium.setState({ ready: true });
    return;
  }
  try {
    Purchases.configure({ apiKey: apiKey! });
    configured = true;
    Purchases.addCustomerInfoUpdateListener(apply);
    apply(await Purchases.getCustomerInfo());
  } catch (e) {
    usePremium.setState({ error: String((e as Error).message ?? e) });
  } finally {
    usePremium.setState({ ready: true });
  }
}

export async function loadPackages() {
  if (!configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    usePremium.setState({ packages, error: undefined });
    return packages;
  } catch (e) {
    usePremium.setState({ error: String((e as Error).message ?? e) });
    return [];
  }
}

/** Resolves true only when the store reports the entitlement active. */
export async function buy(pkg: PurchasesPackage): Promise<'ok' | 'cancelled'> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    apply(customerInfo);
    if (!customerInfo.entitlements.active[ENTITLEMENT]) throw new Error('Purchase completed but Pro is not active yet. Try Restore.');
    return 'ok';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  if (!configured) throw new Error('The store is not available on this build.');
  const info = await Purchases.restorePurchases();
  apply(info);
  return !!info.entitlements.active[ENTITLEMENT];
}

export async function manageSubscriptions() {
  if (!configured) return;
  await Purchases.showManageSubscriptions();
}
