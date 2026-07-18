import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return;
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return;
  }
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('EAS Project ID not found. Remote push notifications will not be active (normal in local Expo Go without EAS setup).');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token:', token);
    await api.post('/users/push-token', { push_token: token });
  } catch (error) {
    console.warn('Error getting push token:', error);
  }
}

async function scheduleDailyReminder(isTodayCheckedIn: boolean) {
  if (Platform.OS === 'web') return;
  // Cancel previous scheduled reminders
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Next reminder targeted at 10:00 AM local time
  const targetDate = new Date();
  targetDate.setHours(10, 0, 0, 0);

  if (isTodayCheckedIn) {
    // Already checked in today, target tomorrow 10:00 AM
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    const now = new Date();
    if (now.getTime() > targetDate.getTime()) {
      // Past 10:00 AM today, target tomorrow 10:00 AM
      targetDate.setDate(targetDate.getDate() + 1);
    }
  }

  // Schedule local notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "İyi misin?",
      body: "Lütfen iyi olduğunuzu onaylamak için 'İyiyim!' butonuna dokunun.",
      data: { type: "checkin_reminder" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: targetDate.getTime(),
    },
  });
  console.log('Scheduled next check-in reminder for:', targetDate.toString());
}

export default function Home() {
  const { user, refreshUser } = useAuth();
  const { fontSizeScale, t, language, colors, comfortMode } = useSettings();
  const cIconSize = comfortMode ? 28 : 24;
  const [loading, setLoading] = useState(false);
  const [checkinData, setCheckinData] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [scaleAnim] = useState(new Animated.Value(1));

  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const infoSteps = language === 'tr' ? [
    "Uygulamamızın aktif kalması için her 7 günde bir en az bir kez 'İyiyim!' butonuna basarak yoklama vermeniz gerekmektedir.",
    "7 günlük süre içinde yoklama vermezseniz, sistem otomatik olarak 7 günlük bir 'bekleme dönemine' geçiş yapmaktadır.",
    "Bekleme dönemi 7 gün sürmektedir. Bu süreçte uygulama yöneticimiz, sistemde kayıtlı telefon numaranız üzerinden SMS veya telefon araması ile size ulaşmaya çalışacaktır. Eğer bu süreçte de yoklama vermezseniz veya size ulaşılamazsa, kaydettiğiniz mesaj(lar) belirlediğiniz alıcılara otomatik olarak iletilecektir.",
    "Uygulama şifreniz ve mesaj şifreleme parolalarınız tamamen size özeldir. Güvenliğiniz için lütfen kimseyle paylaşmayın.",
    "Toplam 14 günlük (7 gün normal + 7 gün bekleme) sürecin sonunda mesaj gönderim işlemi başladıktan sonra bu işlemin geri dönüşü yoktur.",
    "Mesajlarınız alıcılara ulaştırıldıktan sonra, alıcılar mesajı teslim aldığında sistemimizden kalıcı ve geri döndürülemez olarak silinmektedir.",
    "Mesajlarınız, bekleme süresi sonunda alıcılara şifreli olarak iletilir; böylece verileriniz her aşamada güvende kalır.",
    "Mesajlarınız sistemlerimizde şifreli olarak saklanır. Mesajların içeriğini sistem üzerinden sadece kendiniz görebilirsiniz. Alıcılar ise içeriği ancak bekleme süresi sonunda mesaj kendilerine ulaştığında görebilirler.",
    "Yöneticinin size ulaşabilmesi için profilinizdeki telefon numarasının her zaman güncel, doğru ve aktif olması gerekmektedir.",
    "Yoklama sürelerini kaçırmamak ve sistemin bekleme dönemine girmesini engellemek için cihaz bildirimlerinizi açık tutmanız önerilir."
  ] : [
    "To keep the application active, you must press the 'I'm Good!' button at least once every 7 days.",
    "If you do not check in within the 7-day period, the system automatically enters a 7-day waiting period.",
    "The waiting period lasts for 7 days. During this time, our system administrator will attempt to contact you via SMS or phone call. If you still do not press the button or cannot be reached, your saved message(s) will be automatically delivered to your designated recipients.",
    "Your application password and message encryption passwords are strictly private. For your security, please do not share them with anyone.",
    "After the total 14-day cycle (7 days normal + 7 days waiting), once the message delivery process begins, it cannot be undone.",
    "Once your messages are successfully delivered to and read by the recipients, they are permanently and irreversibly deleted from our systems.",
    "At the end of the waiting period, your messages are delivered to recipients in an encrypted format, ensuring your data remains secure at every step.",
    "Your messages are stored end-to-end encrypted on our servers. Only you can view the contents. Recipients can only view the messages after they are delivered at the end of the cycle.",
    "Your profile phone number must always be accurate and up-to-date so the administrator can reach you if needed.",
    "It is highly recommended to keep push notifications enabled to avoid missing check-in deadlines."
  ];

  const appInfoButtonText = language === 'tr' ? 'Uygulama Bilgisi / Nasıl Çalışır?' : 'Application Information / How It Works';
  const appInfoTitleText = language === 'tr' ? 'Uygulama Bilgisi' : 'Application Information';
  const appInfoCloseText = language === 'tr' ? 'Kapat' : 'Close';

  useEffect(() => {
    if (user?.referral_eligible) {
      setShowReferralModal(true);
    }
  }, [user?.referral_eligible]);

  const handleSubmitReferral = async () => {
    if (!referralInput.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    setSubmittingReferral(true);
    try {
      await api.post('/users/submit-referral', { referral_code: referralInput.trim() });
      setShowReferralModal(false);
      Alert.alert(t('success'), t('purchaseSuccess') || 'Referans kodu başarıyla uygulandı!');
      await refreshUser();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Geçersiz referans kodu.');
    } finally {
      setSubmittingReferral(false);
    }
  };

  const handleSkipReferral = async () => {
    setSubmittingReferral(true);
    try {
      await api.post('/users/skip-referral');
      setShowReferralModal(false);
      await refreshUser();
    } catch (error) {
      console.error('Error skipping referral:', error);
      setShowReferralModal(false);
    } finally {
      setSubmittingReferral(false);
    }
  };

  useEffect(() => {
    // 1. Load History
    loadCheckinData();

    // 2. Setup notifications
    registerForPushNotificationsAsync();

    // 3. Listener for notification click
    let subscription: any;
    if (Platform.OS !== 'web') {
      subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data && data.type === 'checkin_reminder') {
          console.log('App opened from checkin reminder notification');
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  const loadCheckinData = async () => {
    try {
      const response = await api.get('/users/checkin-history');
      if (response.data.length > 0) {
        setCheckinData(response.data[0]);
        // Calculate streak
        let currentStreak = 1;
        for (let i = 1; i < response.data.length; i++) {
          const prev = new Date(response.data[i].checkin_date);
          const curr = new Date(response.data[i - 1].checkin_date);
          const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) {
            currentStreak++;
          } else {
            break;
          }
        }
        setStreak(currentStreak);

        // Schedule notification based on today's checkin status
        const isToday = new Date(response.data[0].checkin_date).toDateString() === new Date().toDateString();
        scheduleDailyReminder(isToday);
      } else {
        // No checkins yet, schedule reminder for today/tomorrow 10am
        scheduleDailyReminder(false);
      }
    } catch (error) {
      console.error('Error loading check-in data:', error);
      scheduleDailyReminder(false);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    
    // Animate button
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const response = await api.post('/users/checkin');
      setCheckinData({
        checkin_date: response.data.last_checkin,
        status: 'checked_in',
      });
      setStreak(response.data.streak);
      await refreshUser();
      
      // Reschedule next reminder to tomorrow 10am since we just checked in
      scheduleDailyReminder(true);
      
      Alert.alert(t('success'), response.data.message);
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('checkinFailedMsg'));
    } finally {
      setLoading(false);
    }
  };

  const getTierBadgeColor = (tier: string) => {
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

  const daysSinceCheckin = user?.last_checkin
    ? Math.floor((new Date().getTime() - new Date(user.last_checkin).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const isToday = checkinData
    ? new Date(checkinData.checkin_date).toDateString() === new Date().toDateString()
    : false;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>{t('hello')}</Text>
            <Text style={[styles.name, { fontSize: 28 * fontSizeScale, color: colors.textPrimary }]}>{user?.full_name}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.pointsBadge, { backgroundColor: colors.surface, borderColor: '#fbbf24' }]}>
              <Ionicons name="gift" size={comfortMode ? 20 : 16} color="#fbbf24" style={{ marginRight: 4 }} />
              <Text style={[styles.pointsText, { fontSize: 13 * fontSizeScale }]}>
                {user?.symi_points || 0} SYMI
              </Text>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: getTierBadgeColor(user?.subscription_tier || 'free') }]}>
              <Text style={[styles.tierText, { fontSize: 12 * fontSizeScale }]}>
                {user?.subscription_tier?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={daysSinceCheckin === 0 ? 'checkmark-circle' : 'alert-circle'}
              size={comfortMode ? 40 : 32}
              color={daysSinceCheckin === 0 ? colors.success : colors.warning}
            />
            <Text style={[styles.statusTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
              {daysSinceCheckin === 0 ? t('allSet') : t('actionRequired')}
            </Text>
          </View>
          <Text style={[styles.statusDescription, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>
            {daysSinceCheckin === 0
              ? t('keepUpGoodWork')
              : t('daysSinceLastCheckin')
                  .replace('{days}', String(daysSinceCheckin))
                  .replace('{plural}', daysSinceCheckin > 1 ? 's' : '')}
          </Text>
          {daysSinceCheckin >= 7 && (
            <View style={[styles.warningBanner, { backgroundColor: colors.dangerBg }]}>
              <Ionicons name="warning" size={cIconSize} color={colors.danger} />
              <Text style={[styles.warningText, { fontSize: 14 * fontSizeScale }]}>
                {daysSinceCheckin >= 14
                  ? t('warningBanner14')
                  : t('warningBanner7')}
              </Text>
            </View>
          )}
        </View>

        {/* Check-in Button */}
        <View style={styles.checkinSection}>
          <Text style={[styles.sectionTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>{t('dailyCheckin')}</Text>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.checkinButton,
                { backgroundColor: colors.accent },
                isToday && [styles.checkinButtonDisabled, { backgroundColor: colors.badgeBg }],
                comfortMode && { padding: 48, minHeight: 240 },
              ]}
              onPress={handleCheckIn}
              disabled={loading || isToday}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={isToday ? 'checkmark-circle' : 'heart-circle'}
                    size={80}
                    color="#fff"
                  />
                  <Text style={[styles.checkinButtonText, { fontSize: 28 * fontSizeScale }]}>
                    {isToday ? t('checkedInToday') : t('imAlive')}
                  </Text>
                  {!isToday && (
                    <Text style={[styles.checkinSubtext, { fontSize: 16 * fontSizeScale }]}>
                      {t('tapToConfirm')}
                    </Text>
                  )}
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="flame" size={comfortMode ? 40 : 32} color="#f59e0b" />
            <Text style={[styles.statValue, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>{streak}</Text>
            <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale, color: colors.textSecondary }]}>{t('dayStreak')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar" size={comfortMode ? 40 : 32} color={colors.accent} />
            <Text style={[styles.statValue, { fontSize: 22 * fontSizeScale, color: colors.textPrimary }]}>
              {checkinData ? format(new Date(checkinData.checkin_date), language === 'tr' ? 'dd MMM' : 'MMM dd', { locale: language === 'tr' ? tr : enUS }) : '--'}
            </Text>
            <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale, color: colors.textSecondary }]}>{t('lastCheckinLabel')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={comfortMode ? 40 : 32} color={colors.success} />
            <Text style={[styles.statValue, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>
              {user?.status === 'active' ? t('activeStatus') : user?.status}
            </Text>
            <Text style={[styles.statLabel, { fontSize: 12 * fontSizeScale, color: colors.textSecondary }]}>{t('statusLabel')}</Text>
          </View>
        </View>

        {/* Info Section Button */}
        <TouchableOpacity
          style={[styles.infoButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowInfoModal(true)}
        >
          <Ionicons name="information-circle" size={cIconSize} color={colors.accent} style={{ marginRight: 8 }} />
          <Text style={[styles.infoButtonText, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>
            {appInfoButtonText}
          </Text>
          <Ionicons name="chevron-forward" size={cIconSize - 4} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </ScrollView>

      {/* Referral Code Modal */}
      <Modal
        visible={showReferralModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReferralModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="gift-outline" size={32} color="#fbbf24" />
                <Text style={[styles.modalTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
                  {t('referredByModalTitle')}
                </Text>
              </View>
              <Text style={[styles.modalDescription, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
                {t('referredByModalDesc')}
              </Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 16 * fontSizeScale, backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.inputText }]}
                placeholder={t('referralCodePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={referralInput}
                onChangeText={setReferralInput}
                autoCapitalize="characters"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton, { backgroundColor: colors.badgeBg }]}
                  onPress={handleSkipReferral}
                  disabled={submittingReferral}
                >
                  <Text style={[styles.modalCancelButtonText, { fontSize: 15 * fontSizeScale, color: colors.textSecondary }]}>
                    {t('skipBtn')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSubmitButton]}
                  onPress={handleSubmitReferral}
                  disabled={submittingReferral}
                >
                  {submittingReferral ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.modalSubmitButtonText, { fontSize: 15 * fontSizeScale }]}>
                      {t('submitBtn')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Application Information Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={[styles.infoModalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View style={[styles.infoModalContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.infoModalHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={28} color={colors.accent} />
              <Text style={[styles.infoModalTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]} numberOfLines={1}>
                {appInfoTitleText}
              </Text>
              <TouchableOpacity
                onPress={() => setShowInfoModal(false)}
                style={styles.infoModalCloseIcon}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView
              style={styles.infoModalScroll}
              contentContainerStyle={styles.infoModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {infoSteps.map((stepText, index) => (
                <View key={index} style={[styles.infoStepItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <View style={[styles.infoStepNumberContainer, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.infoStepNumber, { fontSize: 13 * fontSizeScale }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.infoStepText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
                    {stepText}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalCloseButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={[styles.infoModalCloseButtonText, { fontSize: 16 * fontSizeScale }]}>
                {appInfoCloseText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    color: '#94a3b8',
  },
  name: {
    fontWeight: 'bold',
    color: '#fff',
  },
  tierBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tierText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  statusDescription: {
    color: '#94a3b8',
    lineHeight: 24,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    color: '#fca5a5',
    marginLeft: 8,
    fontWeight: '600',
  },
  checkinSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  checkinButton: {
    backgroundColor: '#6366f1',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  checkinButtonDisabled: {
    backgroundColor: '#334155',
  },
  checkinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 16,
  },
  checkinSubtext: {
    color: '#cbd5e1',
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 4,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  infoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    width: '100%',
    maxWidth: 450,
    height: 550,
    maxHeight: '85%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 16,
    marginBottom: 16,
  },
  infoModalTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  infoModalCloseIcon: {
    padding: 4,
  },
  infoModalScroll: {
    flex: 1,
    marginBottom: 16,
  },
  infoModalScrollContent: {
    paddingRight: 4,
  },
  infoStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoStepNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  infoStepNumber: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoStepText: {
    flex: 1,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  infoModalCloseButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalCloseButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pointsText: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
  modalDescription: {
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalCancelButton: {
    backgroundColor: '#334155',
  },
  modalCancelButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  modalSubmitButton: {
    backgroundColor: '#fbbf24',
  },
  modalSubmitButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
