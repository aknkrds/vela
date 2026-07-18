import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '@/src/api/client';
import * as Clipboard from 'expo-clipboard';
import { Switch } from 'react-native';
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE } from '@/src/utils/theme';
import { isRunningInExpoGo } from 'expo';

// Helper to get notifications module dynamically
const getNotificationsModule = () => {
  if (isRunningInExpoGo()) {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch (error) {
    console.warn('Failed to require expo-notifications:', error);
    return null;
  }
};

interface SubscriptionPlan {
  name: string;
  display_name: string;
  price: number;
  max_recipients: number;
  max_messages: number;
  allowed_types: string[];
  features: string[];
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const { fontSizeScale, t, language, setLanguage, increaseFontScale, decreaseFontScale, resetFontScale, theme, setTheme, comfortMode, toggleComfortMode, colors } = useSettings();
  const router = useRouter();
  const iconSize = comfortMode ? COMFORT_ICON_SIZE : 20;
  const btnHeight = comfortMode ? COMFORT_BUTTON_HEIGHT : 56;
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string>('undetermined');

  // Packages Shop
  const [packages, setPackages] = useState<any[]>([]);
  const [purchasingPkg, setPurchasingPkg] = useState<string | null>(null);

  // Profile Request states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'phone'>('email');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Password Change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  useEffect(() => {
    loadPlans();
    checkNotificationStatus();
    loadPackages();
    loadUserRequests();
  }, []);

  useEffect(() => {
    if (user?.approved_requests && user.approved_requests.length > 0) {
      Alert.alert(
        t('success'),
        "Yönetici tarafından isteğiniz onaylandı. Profil sekmesinden istekte bulunduğunuz alanı değiştirebilirsiniz."
      );
    }
  }, [user?.approved_requests]);

  const loadPackages = async () => {
    try {
      const response = await api.get('/packages');
      setPackages(response.data);
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const loadUserRequests = async () => {
    try {
      const response = await api.get('/users/profile-requests');
      setPendingRequests(response.data.filter((r: any) => r.status === 'pending'));
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const handlePurchasePackage = async (packageId: string) => {
    setPurchasingPkg(packageId);
    try {
      const response = await api.post('/packages/purchase', { package_id: packageId });
      Alert.alert(t('success'), response.data.message || t('purchaseSuccess'));
      await refreshUser();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Satın alma başarısız.');
    } finally {
      setPurchasingPkg(null);
    }
  };

  const handleSendProfileRequest = async () => {
    if (!newValue.trim() || !reason.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    setSubmittingRequest(true);
    try {
      const response = await api.post('/users/profile-request', {
        field: activeField,
        new_value: newValue.trim(),
        reason: reason.trim()
      });
      Alert.alert(t('success'), response.data.message || t('requestSubmitted'));
      setShowRequestModal(false);
      setNewValue('');
      setReason('');
      await loadUserRequests();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Talep iletilemedi.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleConsumeRequest = async (requestId: string) => {
    try {
      const response = await api.post('/users/consume-profile-request', { request_id: requestId });
      Alert.alert(t('success'), response.data.message || 'Profil güncellendi!');
      await refreshUser();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Güncelleme başarısız.');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    setSubmittingPassword(true);
    try {
      const response = await api.post('/users/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      Alert.alert(t('success'), response.data.message || t('passwordChangedSuccess'));
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Şifre değiştirilemedi.');
    } finally {
      setSubmittingPassword(false);
    }
  };
  const handleCopyReferralCode = async () => {
    if (user?.referral_code) {
      await Clipboard.setStringAsync(user.referral_code);
      Alert.alert(t('success') || 'Başarılı', 'Referans kodu panoya kopyalandı!');
    }
  };

  const renderProfileFieldActions = (field: 'email' | 'phone') => {
    const approved = user?.approved_requests?.find((r: any) => r.field === field);
    if (approved) {
      return (
        <TouchableOpacity
          style={styles.applyRequestBtn}
          onPress={() => handleConsumeRequest(approved.request_id)}
        >
          <Text style={styles.applyRequestBtnText}>Uygula</Text>
        </TouchableOpacity>
      );
    }

    const isPending = pendingRequests.some((r: any) => r.field === field);
    if (isPending) {
      return (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>Beklemede</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.changeRequestBtnLink}
        onPress={() => {
          setActiveField(field);
          setNewValue('');
          setReason('');
          setShowRequestModal(true);
        }}
      >
        <Text style={styles.changeRequestBtnLinkText}>Değiştir</Text>
      </TouchableOpacity>
    );
  };

  const checkNotificationStatus = async () => {
    if (isRunningInExpoGo()) {
      setNotificationStatus('expo-go-unsupported');
      return;
    }
    try {
      const NotificationsMod = getNotificationsModule();
      if (!NotificationsMod) {
        setNotificationStatus('undetermined');
        return;
      }
      const { status } = await NotificationsMod.getPermissionsAsync();
      setNotificationStatus(status);
    } catch (error) {
      console.warn('Error checking notification permissions:', error);
    }
  };

  const handleRequestNotifications = async () => {
    if (isRunningInExpoGo()) {
      Alert.alert(t('warning') || 'Warning', t('notificationExpoGoWarning'));
      return;
    }
    try {
      const NotificationsMod = getNotificationsModule();
      if (!NotificationsMod) return;
      const { status } = await NotificationsMod.requestPermissionsAsync();
      setNotificationStatus(status);
      if (status === 'granted') {
        Alert.alert(t('success'), t('notificationsEnabled'));
        // Try to obtain push token safely
        try {
          const Constants = require('expo-constants').default;
          const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
          if (projectId) {
            const token = (await NotificationsMod.getExpoPushTokenAsync({ projectId })).data;
            await api.post('/users/push-token', { push_token: token });
          }
        } catch (err) {
          console.warn('Could not register for push notifications:', err);
        }
      } else {
        Alert.alert(t('warning') || 'Warning', t('notificationsDenied'));
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      Alert.alert(t('error'), t('notificationRequestFailed'));
    }
  };

  const loadPlans = async () => {
    try {
      const response = await api.get('/subscriptions/plans');
      setPlans(response.data);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('logoutAlertTitle'),
      t('logoutAlertConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logoutAlertTitle'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleSubscribe = async (planName: string) => {
    if (planName === user?.subscription_tier) {
      Alert.alert(t('info') || 'Info', t('alreadyOnPlan'));
      return;
    }

    Alert.alert(
      t('upgradePlan') || 'Subscribe',
      t('switchPlanAlert').replace('{plan}', planName.toUpperCase()),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('success') || 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              await api.post('/subscriptions/subscribe', { plan_name: planName });
              await refreshUser();
              Alert.alert(t('success'), t('saveRecipientSuccess'));
              setShowPlansModal(false);
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('saveRecipientFailed'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getTierColor = (tier: string) => {
    const tierColors: any = {
      free: '#64748b',
      basic: '#94a3b8',
      silver: '#cbd5e1',
      gold: '#fbbf24',
      diamond: '#60a5fa',
      blue_diamond: '#3b82f6',
      platinum: '#a78bfa',
      galaxy: '#ec4899',
    };
    return tierColors[tier] || '#64748b';
  };

  const currentPlan = plans.find(p => p.name === user?.subscription_tier);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={[styles.profileIcon, { backgroundColor: colors.accentDark }]}>
            <Ionicons name="person" size={comfortMode ? 56 : 48} color={colors.accent} />
          </View>
          <Text style={[styles.userName, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>{user?.full_name}</Text>
          <Text style={[styles.userEmail, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>{user?.email}</Text>
          <View style={[styles.tierBadge, { backgroundColor: getTierColor(user?.subscription_tier || 'free') }]}>
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={[styles.tierText, { fontSize: 12 * fontSizeScale }]}>
              {user?.subscription_tier?.toUpperCase()} {t('planLabel').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Current Subscription */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{t('subscriptionSection')}</Text>
          {currentPlan && (
            <View style={[styles.subscriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.subscriptionHeader}>
                <Text style={[styles.planName, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>{currentPlan.display_name}</Text>
                <Text style={[styles.planPrice, { fontSize: 18 * fontSizeScale, color: colors.accent }]}>
                  {currentPlan.price === 0 ? t('free') || 'FREE' : `$${currentPlan.price}/yr`}
                </Text>
              </View>
              <View style={styles.featuresContainer}>
                {currentPlan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.featureText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{feature}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: colors.accent }]}
                onPress={() => setShowPlansModal(true)}
              >
                <Ionicons name="arrow-up-circle" size={iconSize} color="#fff" />
                <Text style={[styles.upgradeButtonText, { fontSize: 16 * fontSizeScale }]}>{t('upgradePlan')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{t('accountInformation')}</Text>
          
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Email Row */}
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="mail" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('emailPlaceholder')}</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={[styles.infoValue, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>{user?.email}</Text>
                {renderProfileFieldActions('email')}
              </View>
            </View>

            {/* Phone Row */}
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="call" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('phonePlaceholder')}</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={[styles.infoValue, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>{user?.phone || 'Belirtilmedi'}</Text>
                {renderProfileFieldActions('phone')}
              </View>
            </View>

            {/* Password Row */}
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="lock-closed" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('changePasswordTitle')}</Text>
              </View>
              <TouchableOpacity
                style={[styles.changePasswordBtn, { backgroundColor: colors.accentDark }]}
                onPress={() => setShowPasswordModal(true)}
              >
                <Text style={[styles.changePasswordBtnText, { color: colors.accent }]}>{t('changePasswordTitle')}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="calendar" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('memberSince')}</Text>
              </View>
              <Text style={[styles.infoValue, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
            
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="shield-checkmark" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('statusLabel')}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.successBg }]}>
                <Text style={[styles.statusText, { fontSize: 12 * fontSizeScale, color: colors.success }]}>
                  {user?.status?.toUpperCase() === 'ACTIVE' ? t('activeStatus').toUpperCase() : user?.status?.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Points Shop */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{t('pointsShopTitle')}</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.shopDesc, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('pointsShopDesc')}</Text>
            {packages.length > 0 ? (
              packages.map((pkg: any) => (
                <View key={pkg.package_id} style={[styles.packageRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.packageNameText, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{pkg.display_name}</Text>
                    <Text style={[styles.packageDescText, { fontSize: 13 * fontSizeScale, color: colors.textSecondary }]}>{pkg.description}</Text>
                    <Text style={[styles.packageCostText, { fontSize: 13 * fontSizeScale }]}>
                      {t('pointsCostLabel')} {pkg.points_cost} SYMI
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.purchaseBtn,
                      { backgroundColor: '#fbbf24' },
                      (user?.symi_points || 0) < pkg.points_cost && [styles.purchaseBtnDisabled, { backgroundColor: colors.badgeBg }]
                    ]}
                    disabled={(user?.symi_points || 0) < pkg.points_cost || purchasingPkg === pkg.package_id}
                    onPress={() => handlePurchasePackage(pkg.package_id)}
                  >
                    {purchasingPkg === pkg.package_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.purchaseBtnText, { color: (user?.symi_points || 0) < pkg.points_cost ? colors.textMuted : '#0f172a' }]}>{t('purchaseBtn')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                Yükleniyor veya mağaza paketi bulunmuyor.
              </Text>
            )}
          </View>
        </View>

        {/* Referral System */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{t('referralTitle')}</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.shopDesc, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('referralDesc')}</Text>
            
            <View style={[styles.referralCodeContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text style={[styles.referralCodeLabel, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('referralCodeLabel')}</Text>
              <TouchableOpacity
                style={[styles.referralCodeBox, { backgroundColor: colors.surface, borderColor: '#fbbf24' }]}
                onPress={handleCopyReferralCode}
              >
                <Text style={[styles.referralCodeValue, { fontSize: 18 * fontSizeScale }]}>{user?.referral_code || '------'}</Text>
              </TouchableOpacity>
            </View>

            {/* Milestones Progress Tracker */}
            <View style={styles.milestonesContainer}>
              <View style={[styles.progressLine, { backgroundColor: colors.border }]} />
              {[1, 2, 3, 4, 5].map((num) => {
                const isCompleted = (user?.referrals?.length || 0) >= num;
                const points = num === 5 ? 100 : 15;
                return (
                  <View key={num} style={styles.milestoneItem}>
                    <View style={[
                      styles.milestoneCircle,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      isCompleted && [styles.milestoneCircleCompleted, { backgroundColor: colors.success, borderColor: colors.success }]
                    ]}>
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      ) : (
                        <Text style={[styles.milestoneNumber, { color: colors.textSecondary }]}>{num}</Text>
                      )}
                    </View>
                    <Text style={[styles.milestonePointsText, { color: colors.textSecondary }]}>{points} P</Text>
                  </View>
                );
              })}
            </View>

            {/* Referred Users List */}
            <Text style={[styles.referredTitle, { fontSize: 15 * fontSizeScale, color: colors.textPrimary }]}>{t('referredUsersLabel')}</Text>
            {user?.referrals && user.referrals.length > 0 ? (
              user.referrals.map((ref: any, index: number) => (
                <View key={index} style={[styles.referredUserItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Ionicons name="person-circle-outline" size={comfortMode ? 28 : 24} color={colors.accent} />
                  <Text style={[styles.referredUserName, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>{ref.full_name}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.referredUserDate}>+{ref.points_awarded} SYMI</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noReferralsText, { fontSize: 13 * fontSizeScale, color: colors.textMuted }]}>
                Henüz davet ettiğiniz üye bulunmuyor.
              </Text>
            )}
          </View>
        </View>

        {/* Support Panel */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{t('supportTitle')}</Text>
          
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Create Ticket */}
            <TouchableOpacity
              style={[styles.settingsRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/support/create')}
            >
              <View style={styles.infoLabel}>
                <Ionicons name="help-buoy-outline" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('supportCreateTicket')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* My Tickets List */}
            <TouchableOpacity
              style={[styles.settingsRow, { borderBottomWidth: 0, paddingBottom: 0 }]}
              onPress={() => router.push('/support/list')}
            >
              <View style={styles.infoLabel}>
                <Ionicons name="chatbubbles-outline" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('supportMyTickets')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Panel */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{t('settingsSection')}</Text>
          
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>

            {/* Theme Toggle */}
            <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name={theme === 'dark' ? 'moon' : 'sunny'} size={iconSize} color={theme === 'dark' ? '#fbbf24' : '#f59e0b'} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('themeLabel')}</Text>
              </View>
              <View style={styles.languageToggleContainer}>
                <TouchableOpacity
                  style={[styles.langButton, { borderColor: colors.border }, theme === 'light' && [styles.langButtonActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
                  onPress={() => setTheme('light')}
                >
                  <Text style={[styles.langButtonText, { color: colors.textMuted }, theme === 'light' && styles.langButtonTextActive, { fontSize: 13 * fontSizeScale }]}>{t('themeLight')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langButton, { borderColor: colors.border }, theme === 'dark' && [styles.langButtonActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
                  onPress={() => setTheme('dark')}
                >
                  <Text style={[styles.langButtonText, { color: colors.textMuted }, theme === 'dark' && styles.langButtonTextActive, { fontSize: 13 * fontSizeScale }]}>{t('themeDark')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Comfort Mode Toggle */}
            <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="accessibility-outline" size={iconSize} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('comfortModeLabel')}</Text>
                  <Text style={[{ fontSize: 11 * fontSizeScale, color: colors.textMuted, marginTop: 2 }]}>{t('comfortModeDesc')}</Text>
                </View>
              </View>
              <Switch
                value={comfortMode}
                onValueChange={toggleComfortMode}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={comfortMode ? '#ffffff' : '#f4f3f4'}
              />
            </View>
            {/* Language Selection */}
            <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="globe-outline" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('languageLabel')}</Text>
              </View>
              <View style={styles.languageToggleContainer}>
                <TouchableOpacity
                  style={[styles.langButton, { borderColor: colors.border }, language === 'tr' && [styles.langButtonActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
                  onPress={() => setLanguage('tr')}
                >
                  <Text style={[styles.langButtonText, { color: colors.textMuted }, language === 'tr' && styles.langButtonTextActive, { fontSize: 13 * fontSizeScale }]}>TR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langButton, { borderColor: colors.border }, language === 'en' && [styles.langButtonActive, { backgroundColor: colors.accent, borderColor: colors.accent }]]}
                  onPress={() => setLanguage('en')}
                >
                  <Text style={[styles.langButtonText, { color: colors.textMuted }, language === 'en' && styles.langButtonTextActive, { fontSize: 13 * fontSizeScale }]}>EN</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Font Size Scaling */}
            <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="text-outline" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('fontSizeLabel')}</Text>
              </View>
              <View style={styles.fontSizeControls}>
                <TouchableOpacity style={styles.fontScaleButton} onPress={decreaseFontScale}>
                  <Ionicons name="remove-circle-outline" size={22} color={colors.accent} />
                </TouchableOpacity>
                <Text style={[styles.fontScaleValue, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>
                  {t('fontSizeValue').replace('{scale}', String(Math.round(fontSizeScale * 100)))}
                </Text>
                <TouchableOpacity style={styles.fontScaleButton} onPress={increaseFontScale}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.fontScaleReset} onPress={resetFontScale}>
                  <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications Permission */}
            <View style={[styles.settingsRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={styles.infoLabel}>
                <Ionicons name="notifications-outline" size={iconSize} color={colors.accent} />
                <Text style={[styles.infoLabelText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{t('notificationsLabel')}</Text>
              </View>
              <View style={styles.notificationStatusContainer}>
                <View style={[
                  styles.notificationStatusBadge,
                  { 
                    backgroundColor: notificationStatus === 'granted' 
                      ? '#10b981' 
                      : notificationStatus === 'expo-go-unsupported'
                      ? '#64748b'
                      : '#f59e0b'
                  }
                ]}>
                  <Text style={[styles.notificationStatusText, { fontSize: 12 * fontSizeScale }]}>
                    {notificationStatus === 'granted'
                      ? t('notificationStatusGranted')
                      : notificationStatus === 'denied'
                      ? t('notificationStatusDenied')
                      : notificationStatus === 'expo-go-unsupported'
                      ? t('notificationStatusUnsupported')
                      : t('notificationStatusUndetermined')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Unsupported message for Expo Go */}
            {notificationStatus === 'expo-go-unsupported' && (
              <View style={styles.unsupportedCard}>
                <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                <Text style={[styles.unsupportedText, { fontSize: 12 * fontSizeScale }]}>
                  {t('notificationExpoGoWarning')}
                </Text>
              </View>
            )}

            {/* Notifications Prompt Button */}
            {notificationStatus !== 'granted' && notificationStatus !== 'expo-go-unsupported' && (
              <TouchableOpacity
                style={styles.enableNotificationsButton}
                onPress={handleRequestNotifications}
              >
                <Ionicons name="notifications" size={18} color="#fff" />
                <Text style={[styles.enableNotificationsButtonText, { fontSize: 13 * fontSizeScale }]}>
                  {t('enableNotificationsBtn')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={iconSize + 4} color={colors.danger} />
            <Text style={[styles.actionButtonText, { fontSize: 16 * fontSizeScale, color: colors.danger }]}>{t('logOutButton')}</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Link */}
        {user?.role === 'admin' && (
          <View style={[styles.section, { borderBottomWidth: 0 }]}>
            <TouchableOpacity
              style={[styles.adminButton, { backgroundColor: colors.accent, height: btnHeight }]}
              onPress={() => router.push('/admin' as any)}
            >
              <Ionicons name="shield" size={iconSize} color="#fff" />
              <Text style={[styles.adminButtonText, { fontSize: 16 * fontSizeScale }]}>{t('adminPanelButton')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Profile Change Request Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={[styles.profileModalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.profileModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.profileModalTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
              {t('requestProfileChangeTitle')}
            </Text>
            <Text style={[styles.profileModalSub, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
              {activeField === 'email' ? 'Yeni E-posta Adresi:' : 'Yeni Telefon Numarası:'}
            </Text>
            <TextInput
              style={[styles.profileModalInput, { fontSize: 16 * fontSizeScale, backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.inputText }]}
              placeholder={activeField === 'email' ? 'ornek@eposta.com' : '+905555555555'}
              placeholderTextColor={colors.inputPlaceholder}
              value={newValue}
              onChangeText={setNewValue}
              keyboardType={activeField === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
            />
            <Text style={[styles.profileModalSub, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
              Değişiklik Gerekçesi (Neden değiştirmek istiyorsunuz?):
            </Text>
            <TextInput
              style={[styles.profileModalInput, { fontSize: 16 * fontSizeScale, height: 80, backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.inputText }]}
              placeholder={t('reasonPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={reason}
              onChangeText={setReason}
              multiline
            />
            <View style={styles.profileModalButtons}>
              <TouchableOpacity
                style={[styles.profileModalButton, styles.profileModalCancelButton, { backgroundColor: colors.badgeBg }]}
                onPress={() => setShowRequestModal(false)}
                disabled={submittingRequest}
              >
                <Text style={[styles.profileModalCancelButtonText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileModalButton, styles.profileModalSubmitButton, { backgroundColor: colors.accent }]}
                onPress={handleSendProfileRequest}
                disabled={submittingRequest}
              >
                {submittingRequest ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.profileModalSubmitButtonText}>{t('submitBtn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={[styles.profileModalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.profileModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.profileModalTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
              {t('changePasswordTitle')}
            </Text>
            <TextInput
              style={[styles.profileModalInput, { fontSize: 16 * fontSizeScale, backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.inputText }]}
              placeholder={t('currentPasswordPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={[styles.profileModalInput, { fontSize: 16 * fontSizeScale, backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.inputText }]}
              placeholder={t('newPasswordPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <View style={styles.profileModalButtons}>
              <TouchableOpacity
                style={[styles.profileModalButton, styles.profileModalCancelButton, { backgroundColor: colors.badgeBg }]}
                onPress={() => setShowPasswordModal(false)}
                disabled={submittingPassword}
              >
                <Text style={[styles.profileModalCancelButtonText, { color: colors.textSecondary }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileModalButton, styles.profileModalSubmitButton, { backgroundColor: colors.accent }]}
                onPress={handleChangePassword}
                disabled={submittingPassword}
              >
                {submittingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.profileModalSubmitButtonText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Plans Modal */}
      <Modal
        visible={showPlansModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlansModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>{t('chooseYourPlan')}</Text>
              <TouchableOpacity onPress={() => setShowPlansModal(false)}>
                <Ionicons name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.plansScroll}>
              {plans.map((plan) => (
                <View
                  key={plan.name}
                  style={[
                    styles.planCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    plan.name === user?.subscription_tier && [styles.planCardCurrent, { borderColor: colors.accent }],
                  ]}
                >
                  <View style={[styles.planHeader, { borderBottomColor: colors.border }]}>
                    <View>
                      <Text style={[styles.planTitle, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{plan.display_name}</Text>
                      <Text style={[styles.planPriceText, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>
                        {plan.price === 0 ? t('free') || 'FREE' : `$${plan.price}/yr`}
                      </Text>
                    </View>
                    {plan.name === user?.subscription_tier && (
                      <View style={[styles.currentBadge, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.currentBadgeText, { fontSize: 10 * fontSizeScale }]}>
                          {t('currentPlanLabel').toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.planFeatures}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.planFeatureItem}>
                        <Ionicons name="checkmark" size={16} color={colors.success} />
                        <Text style={[styles.planFeatureText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      { backgroundColor: colors.accent, height: btnHeight, justifyContent: 'center' },
                      plan.name === user?.subscription_tier && [styles.selectButtonDisabled, { backgroundColor: colors.badgeBg }],
                    ]}
                    onPress={() => handleSubscribe(plan.name)}
                    disabled={loading || plan.name === user?.subscription_tier}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.selectButtonText, { fontSize: 16 * fontSizeScale, color: plan.name === user?.subscription_tier ? colors.textMuted : '#fff' }]}>
                        {plan.name === user?.subscription_tier ? t('currentPlanLabel') : t('selectPlanLabel')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  profileIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userName: {
    fontWeight: 'bold',
    color: '#fff',
  },
  userEmail: {
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 16,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  tierText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  subscriptionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 16,
    marginBottom: 16,
  },
  planName: {
    fontWeight: 'bold',
    color: '#fff',
  },
  planPrice: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  featureText: {
    color: '#cbd5e1',
  },
  upgradeButton: {
    flexDirection: 'row',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabelText: {
    color: '#cbd5e1',
  },
  infoValue: {
    color: '#fff',
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: '#065f46',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    gap: 8,
  },
  actionButtonText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  adminButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  plansScroll: {
    padding: 20,
  },
  planCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  planCardCurrent: {
    borderColor: '#6366f1',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 16,
    marginBottom: 16,
  },
  planTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  planPriceText: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  currentBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  planFeatures: {
    marginBottom: 20,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  planFeatureText: {
    color: '#cbd5e1',
  },
  selectButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  selectButtonDisabled: {
    backgroundColor: '#334155',
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  languageToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  langButtonActive: {
    backgroundColor: '#6366f1',
  },
  langButtonText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  langButtonTextActive: {
    color: '#fff',
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontScaleButton: {
    padding: 4,
  },
  fontScaleValue: {
    color: '#fff',
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  fontScaleReset: {
    padding: 6,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  notificationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  notificationStatusText: {
    color: '#fff',
    fontWeight: '600',
  },
  enableNotificationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  enableNotificationsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applyRequestBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  applyRequestBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pendingBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  changeRequestBtnLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  changeRequestBtnLinkText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: 'bold',
  },
  changePasswordBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changePasswordBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  shopDesc: {
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 20,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 12,
  },
  packageNameText: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  packageDescText: {
    color: '#94a3b8',
    marginBottom: 4,
  },
  packageCostText: {
    color: '#fbbf24',
    fontWeight: '600',
  },
  purchaseBtn: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  purchaseBtnDisabled: {
    backgroundColor: '#334155',
  },
  purchaseBtnText: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 14,
  },
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  referralCodeLabel: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  referralCodeBox: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  referralCodeValue: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  milestonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  progressLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#334155',
    top: 15,
    zIndex: 1,
  },
  milestoneItem: {
    alignItems: 'center',
    zIndex: 2,
  },
  milestoneCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  milestoneCircleCompleted: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  milestoneNumber: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  milestonePointsText: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  referredTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  referredUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  referredUserName: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  referredUserDate: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noReferralsText: {
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 8,
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileModalTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  profileModalSub: {
    color: '#cbd5e1',
    marginBottom: 8,
    fontWeight: '600',
  },
  profileModalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 16,
  },
  profileModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  profileModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  profileModalCancelButton: {
    backgroundColor: '#334155',
  },
  profileModalCancelButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  profileModalSubmitButton: {
    backgroundColor: '#6366f1',
  },
  profileModalSubmitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  unsupportedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    gap: 8,
  },
  unsupportedText: {
    color: '#f59e0b',
    flex: 1,
  },
});
