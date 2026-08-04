import { useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, extractErrorMessage } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import api from '@/src/api/client';
import { encryptMessage, hashPassword } from '@/src/utils/encryption';
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE } from '@/src/utils/theme';
import MediaRecorderModal from '@/src/components/MediaRecorderModal';
import ViewMessageModal from '@/src/components/ViewMessageModal';
import AdBanner from '@/src/components/AdBanner';

interface Message {
  _id: string;
  message_type: string;
  recipient_name: string;
  created_at: string;
  is_delivered: boolean;
  delivery_mode?: 'checkin_based' | 'scheduled_date';
  scheduled_at?: string;
  delivery_channel?: string;
  status?: string;
  encrypted_content?: string;
  content?: string;
}

interface Recipient {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
}

export default function Messages() {
  const { user } = useAuth();
  const { fontSizeScale, t, colors, comfortMode } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  
  const btnHeight = comfortMode ? COMFORT_BUTTON_HEIGHT : 56;
  const iconSize = comfortMode ? COMFORT_ICON_SIZE : 20;

  // Form state
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'audio' | 'video'>('text');
  const [messageContent, setMessageContent] = useState('');
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'checkin_based' | 'scheduled_date'>('checkin_based');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [deliveryChannel, setDeliveryChannel] = useState<'both' | 'email' | 'sms'>('both');

  // Date & Time Picker Modal state
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [showRecorderModal, setShowRecorderModal] = useState(false);

  // View Message Modal state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const handleOpenViewModal = (msg: Message) => {
    setSelectedMessage(msg);
    setShowViewModal(true);
  };

  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 20 }, (_, i) => currentYear + i);
  const monthsList = [
    { num: 1, name: 'Ocak' },
    { num: 2, name: 'Şubat' },
    { num: 3, name: 'Mart' },
    { num: 4, name: 'Nisan' },
    { num: 5, name: 'Mayıs' },
    { num: 6, name: 'Haziran' },
    { num: 7, name: 'Temmuz' },
    { num: 8, name: 'Ağustos' },
    { num: 9, name: 'Eylül' },
    { num: 10, name: 'Ekim' },
    { num: 11, name: 'Kasım' },
    { num: 12, name: 'Aralık' },
  ];

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  const [selectedHour, setSelectedHour] = useState<string>('12');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const confirmDatePicker = () => {
    const monthStr = String(selectedMonth).padStart(2, '0');
    const dayStr = String(selectedDay).padStart(2, '0');
    setScheduledDate(`${selectedYear}-${monthStr}-${dayStr}`);
    setShowDatePickerModal(false);
  };

  const confirmTimePicker = () => {
    setScheduledTime(`${selectedHour}:${selectedMinute}`);
    setShowTimePickerModal(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const [messagesRes, recipientsRes] = await Promise.all([
        api.get('/messages'),
        api.get('/recipients'),
      ]);
      setMessages(messagesRes.data);
      setRecipients(recipientsRes.data);
    } catch (error: any) {
      console.error('Error loading messages data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTypes = () => {
    const tier = user?.subscription_tier || 'free';
    const typesByTier: any = {
      free: ['text'],
      basic: ['text'],
      silver: ['text', 'audio'],
      gold: ['text', 'audio', 'video'],
      diamond: ['text', 'audio', 'video'],
      blue_diamond: ['text', 'audio', 'video'],
      platinum: ['text', 'audio', 'video'],
      galaxy: ['text', 'audio', 'video'],
    };
    return typesByTier[tier] || ['text'];
  };

  const handleOpenAddModal = async () => {
    try {
      const recipientsRes = await api.get('/recipients');
      setRecipients(recipientsRes.data);
      if (!recipientsRes.data || recipientsRes.data.length === 0) {
        Alert.alert(t('error'), t('addRecipient'));
        return;
      }
      setShowModal(true);
    } catch (e) {
      if (recipients.length === 0) {
        Alert.alert(t('error'), t('addRecipient'));
        return;
      }
      setShowModal(true);
    }
  };

  const handleCreateMessage = async () => {
    if (!selectedRecipient) {
      Alert.alert(t('error'), t('selectRecipientError'));
      return;
    }
    if (!messageContent.trim()) {
      Alert.alert(t('error'), t('enterMessageError'));
      return;
    }
    if (!encryptionPassword.trim() || encryptionPassword.length < 4) {
      Alert.alert(t('error'), t('setPasswordError'));
      return;
    }

    let scheduledAtIso: string | undefined = undefined;
    if (deliveryMode === 'scheduled_date') {
      if (!scheduledDate || !scheduledTime) {
        Alert.alert(t('error'), t('selectDateError'));
        return;
      }
      const combinedStr = `${scheduledDate.trim()}T${scheduledTime.trim()}:00`;
      const dateObj = new Date(combinedStr);
      if (isNaN(dateObj.getTime()) || dateObj <= new Date()) {
        Alert.alert(t('error'), t('selectDateError'));
        return;
      }
      scheduledAtIso = dateObj.toISOString();
    }

    setModalLoading(true);
    try {
      // Client-side encryption: encrypt the message before sending
      const encryptedContent = encryptMessage(messageContent, encryptionPassword);
      // Hash the password — backend will never see the raw password
      const passwordHash = hashPassword(encryptionPassword);

      const payload: any = {
        recipient_id: selectedRecipient,
        message_type: messageType,
        content: encryptedContent,
        encryption_password: passwordHash,
        delivery_mode: deliveryMode,
        delivery_channel: deliveryChannel,
      };
      if (deliveryMode === 'scheduled_date' && scheduledAtIso) {
        payload.scheduled_at = scheduledAtIso;
      }

      await api.post('/messages', payload);
      
      Alert.alert(t('success'), t('createMessageSuccess'));
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      const errorMsg = extractErrorMessage(error);
      Alert.alert(t('error'), errorMsg || t('createMessageFailed'));
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert(
      t('deleteMessageTitle'),
      t('deleteMessageConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/messages/${messageId}`);
              Alert.alert(t('success'), t('messageDeletedSuccess'));
              loadData();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('deleteMessageFailed'));
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setSelectedRecipient('');
    setMessageType('text');
    setMessageContent('');
    setEncryptionPassword('');
    setDeliveryMode('checkin_based');
    setScheduledDate('');
    setScheduledTime('');
    setDeliveryChannel('both');
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'audio':
        return 'mic';
      case 'video':
        return 'videocam';
      default:
        return 'document-text';
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { fontSize: 28 * fontSizeScale, color: colors.textPrimary }]}>{t('messagesTitle')}</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent, width: comfortMode ? 52 : 44, height: comfortMode ? 52 : 44, borderRadius: comfortMode ? 26 : 22 }]}
          onPress={handleOpenAddModal}
        >
          <Ionicons name="add" size={comfortMode ? 28 : 24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <AdBanner placement="messages" />
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={comfortMode ? 80 : 64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>{t('noMessagesYet')}</Text>
            <Text style={[styles.emptySubtext, { fontSize: 14 * fontSizeScale, color: colors.textMuted }]}>{t('messagesDesc')}</Text>
          </View>
        ) : (
          messages.map((message) => (
            <TouchableOpacity
              key={message._id}
              style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleOpenViewModal(message)}
              activeOpacity={0.7}
            >
              <View style={styles.messageHeader}>
                <View style={[styles.messageIconContainer, { backgroundColor: colors.accentDark }]}>
                  <Ionicons
                    name={getMessageIcon(message.message_type) as any}
                    size={comfortMode ? 28 : 24}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.messageInfo}>
                  <Text style={[styles.recipientName, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{message.recipient_name}</Text>
                  <Text style={[styles.messageType, { fontSize: 12 * fontSizeScale, color: colors.textSecondary }]}>
                    {t(message.message_type + 'Type').toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteMessage(message._id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={iconSize} color={colors.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.messageFooter}>
                <View style={styles.statusBadge}>
                  <Ionicons
                    name={message.is_delivered ? 'checkmark-circle' : (message.delivery_mode === 'scheduled_date' ? 'time-outline' : 'lock-closed')}
                    size={comfortMode ? 20 : 16}
                    color={message.is_delivered ? colors.success : (message.delivery_mode === 'scheduled_date' ? '#f59e0b' : colors.textMuted)}
                  />
                  <Text style={[styles.statusText, { fontSize: 13 * fontSizeScale, color: colors.textSecondary }]}>
                    {message.is_delivered
                      ? t('deliveredStatus')
                      : (message.delivery_mode === 'scheduled_date'
                          ? `📅 ${t('scheduledBadge')} ${message.scheduled_at ? new Date(message.scheduled_at).toLocaleDateString() + ' ' + new Date(message.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}`
                          : `❤️ ${t('legacyBadge')}`)}
                  </Text>
                </View>
                <Text style={[styles.dateText, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>
                  {new Date(message.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Message Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.modalOverlay }]}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>{t('createMessage')}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              {/* Encryption Info Banner */}
              <View style={[styles.encryptionBanner, { backgroundColor: colors.accentDark, borderColor: colors.accent }]}>
                <Ionicons name="shield-checkmark" size={iconSize} color={colors.accent} />
                <Text style={[styles.encryptionBannerText, { fontSize: 13 * fontSizeScale, color: colors.accent }]}>
                  {t('encryptionInfo')}
                </Text>
              </View>

              {/* Delivery Mode Toggle */}
              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('deliveryModeLabel')}</Text>
              <View style={styles.deliveryModeContainer}>
                <TouchableOpacity
                  style={[
                    styles.deliveryModeButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    deliveryMode === 'checkin_based' && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => setDeliveryMode('checkin_based')}
                >
                  <Ionicons name="heart" size={18} color={deliveryMode === 'checkin_based' ? '#fff' : colors.textMuted} />
                  <Text style={[styles.modeText, { fontSize: 13 * fontSizeScale, color: deliveryMode === 'checkin_based' ? '#fff' : colors.textMuted }]}>
                    {t('checkinBasedMode')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deliveryModeButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    deliveryMode === 'scheduled_date' && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => setDeliveryMode('scheduled_date')}
                >
                  <Ionicons name="calendar" size={18} color={deliveryMode === 'scheduled_date' ? '#fff' : colors.textMuted} />
                  <Text style={[styles.modeText, { fontSize: 13 * fontSizeScale, color: deliveryMode === 'scheduled_date' ? '#fff' : colors.textMuted }]}>
                    {t('scheduledDateMode')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date & Time Input (When scheduled_date is selected) */}
              {deliveryMode === 'scheduled_date' && (
                <View style={styles.scheduledContainer}>
                  <Text style={[styles.label, { fontSize: 15 * fontSizeScale, color: colors.textPrimary }]}>{t('scheduledAtLabel')}</Text>
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={[
                        styles.pickerTrigger,
                        { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight },
                        showDatePickerModal && { borderColor: colors.accent, borderWidth: 2 },
                      ]}
                      onPress={() => {
                        setShowDatePickerModal(!showDatePickerModal);
                        setShowTimePickerModal(false);
                      }}
                    >
                      <Ionicons name="calendar" size={20} color={colors.accent} />
                      <Text style={[styles.pickerTriggerText, { fontSize: 14 * fontSizeScale, color: scheduledDate ? colors.textPrimary : colors.inputPlaceholder }]}>
                        {scheduledDate ? scheduledDate : 'Tarih Seçin (Yıl/Ay/Gün)'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pickerTrigger,
                        { width: 130, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight },
                        showTimePickerModal && { borderColor: colors.accent, borderWidth: 2 },
                      ]}
                      onPress={() => {
                        setShowTimePickerModal(!showTimePickerModal);
                        setShowDatePickerModal(false);
                      }}
                    >
                      <Ionicons name="time" size={20} color={colors.accent} />
                      <Text style={[styles.pickerTriggerText, { fontSize: 14 * fontSizeScale, color: scheduledTime ? colors.textPrimary : colors.inputPlaceholder }]}>
                        {scheduledTime ? scheduledTime : 'Saat (14:30)'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Inline Date Picker Panel */}
                  {showDatePickerModal && (
                    <View style={[styles.inlinePickerBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {/* Year Selector */}
                      <Text style={[styles.pickerStepLabel, { color: colors.accent }]}>1. YIL SEÇİN ({currentYear} ve sonrası)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        {yearsList.map((y) => (
                          <TouchableOpacity
                            key={y}
                            style={[
                              styles.chipItem,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              selectedYear === y && { backgroundColor: colors.accent, borderColor: colors.accent },
                            ]}
                            onPress={() => setSelectedYear(y)}
                          >
                            <Text style={[styles.chipText, { color: selectedYear === y ? '#fff' : colors.textPrimary }]}>{y}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Month Selector */}
                      <Text style={[styles.pickerStepLabel, { color: colors.accent }]}>2. AY SEÇİN</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                        {monthsList.map((m) => (
                          <TouchableOpacity
                            key={m.num}
                            style={[
                              styles.chipItem,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              selectedMonth === m.num && { backgroundColor: colors.accent, borderColor: colors.accent },
                            ]}
                            onPress={() => setSelectedMonth(m.num)}
                          >
                            <Text style={[styles.chipText, { color: selectedMonth === m.num ? '#fff' : colors.textPrimary }]}>
                              {m.num}. {m.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Day Selector */}
                      <Text style={[styles.pickerStepLabel, { color: colors.accent }]}>3. GÜN SEÇİN</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1).map((d) => (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.dayChip,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              selectedDay === d && { backgroundColor: colors.accent, borderColor: colors.accent },
                            ]}
                            onPress={() => setSelectedDay(d)}
                          >
                            <Text style={[styles.chipText, { color: selectedDay === d ? '#fff' : colors.textPrimary }]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={[styles.pickerConfirmBtn, { backgroundColor: colors.accent }]} onPress={confirmDatePicker}>
                        <Text style={styles.pickerConfirmBtnText}>Tarihi Seç: {selectedYear}-{String(selectedMonth).padStart(2, '0')}-{String(selectedDay).padStart(2, '0')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Inline Time Picker Panel */}
                  {showTimePickerModal && (
                    <View style={[styles.inlinePickerBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {/* Hour Selector */}
                      <Text style={[styles.pickerStepLabel, { color: colors.accent }]}>SAAT SEÇİN</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {hoursList.map((h) => (
                          <TouchableOpacity
                            key={h}
                            style={[
                              styles.timeChip,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              selectedHour === h && { backgroundColor: colors.accent, borderColor: colors.accent },
                            ]}
                            onPress={() => setSelectedHour(h)}
                          >
                            <Text style={[styles.chipText, { color: selectedHour === h ? '#fff' : colors.textPrimary }]}>{h}:00</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Minute Selector */}
                      <Text style={[styles.pickerStepLabel, { color: colors.accent }]}>DAKİKA SEÇİN</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {minutesList.map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.timeChip,
                              { backgroundColor: colors.background, borderColor: colors.border },
                              selectedMinute === m && { backgroundColor: colors.accent, borderColor: colors.accent },
                            ]}
                            onPress={() => setSelectedMinute(m)}
                          >
                            <Text style={[styles.chipText, { color: selectedMinute === m ? '#fff' : colors.textPrimary }]}>:{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <TouchableOpacity style={[styles.pickerConfirmBtn, { backgroundColor: colors.accent }]} onPress={confirmTimePicker}>
                        <Text style={styles.pickerConfirmBtnText}>Saati Seç: {selectedHour}:{selectedMinute}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Channel Selector */}
                  <Text style={[styles.label, { fontSize: 15 * fontSizeScale, color: colors.textPrimary }]}>{t('deliveryChannelLabel')}</Text>
                  <View style={styles.channelRow}>
                    {[
                      { key: 'both', label: t('bothChannel') },
                      { key: 'email', label: t('emailChannel') },
                      { key: 'sms', label: t('smsChannel') },
                    ].map((ch) => (
                      <TouchableOpacity
                        key={ch.key}
                        style={[
                          styles.channelChip,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          deliveryChannel === ch.key && { backgroundColor: colors.accent, borderColor: colors.accent },
                        ]}
                        onPress={() => setDeliveryChannel(ch.key as any)}
                      >
                        <Text style={[styles.channelChipText, { fontSize: 12 * fontSizeScale, color: deliveryChannel === ch.key ? '#fff' : colors.textSecondary }]}>
                          {ch.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Recipient Selection */}
              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('recipientLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipientScroll}>
                {recipients.map((recipient) => (
                  <TouchableOpacity
                    key={recipient._id}
                    style={[
                      styles.recipientChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      selectedRecipient === recipient._id && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => setSelectedRecipient(recipient._id)}
                  >
                    <Text
                      style={[
                        styles.recipientChipText,
                        { fontSize: 14 * fontSizeScale, color: colors.textSecondary },
                        selectedRecipient === recipient._id && { color: '#fff' },
                      ]}
                    >
                      {recipient.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Message Type */}
              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('messageTypeLabel')}</Text>
              <View style={styles.typeContainer}>
                {getAvailableTypes().map((type: string) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      messageType === type && { backgroundColor: colors.accent, borderColor: colors.accent },
                      comfortMode && { padding: 20 },
                    ]}
                    onPress={() => setMessageType(type as any)}
                  >
                    <Ionicons
                      name={getMessageIcon(type) as any}
                      size={comfortMode ? 28 : 24}
                      color={messageType === type ? '#fff' : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        { fontSize: 13 * fontSizeScale, color: colors.textMuted },
                        messageType === type && { color: '#fff' },
                      ]}
                    >
                      {t(type + 'Type')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message Content */}
              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('messagesTitle')}</Text>
              {messageType === 'text' ? (
                <TextInput
                  style={[styles.textArea, { fontSize: 16 * fontSizeScale, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText }]}
                  placeholder={t('messageContentPlaceholder')}
                  placeholderTextColor={colors.inputPlaceholder}
                  value={messageContent}
                  onChangeText={setMessageContent}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              ) : (
                <View style={[styles.recordingPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border, padding: 20, alignItems: 'center' }]}>
                  <Ionicons
                    name={(messageType === 'audio' ? 'mic-circle' : 'videocam') as any}
                    size={64}
                    color={messageContent ? colors.success : colors.accent}
                  />
                  <Text style={[styles.placeholderText, { fontSize: 16 * fontSizeScale, color: colors.textPrimary, fontWeight: 'bold', marginVertical: 8, textAlign: 'center' }]}>
                    {messageContent
                      ? (messageType === 'audio' ? 'Ses Kaydı Alındı ✓' : 'Video Kaydı Alındı ✓')
                      : (messageType === 'audio' ? 'Sesli Mesaj Kaydı Yapın (Maks 5 dk)' : 'Video Mesaj Kaydı (720P - Maks 5 dk)')}
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor: messageContent ? colors.success : colors.accent,
                      paddingVertical: 12,
                      paddingHorizontal: 24,
                      borderRadius: 12,
                      marginTop: 8,
                    }}
                    onPress={() => setShowRecorderModal(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 * fontSizeScale }}>
                      {messageContent ? 'Tekrar Kaydet' : 'Kaydı Başlat'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Encryption Password */}
              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('encryptionPasswordPlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText, height: btnHeight }]}
                placeholder={t('encryptionPasswordPlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={encryptionPassword}
                onChangeText={setEncryptionPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[
                  styles.createButton,
                  { backgroundColor: colors.accent, height: btnHeight },
                  modalLoading && { backgroundColor: colors.badgeBg },
                ]}
                onPress={handleCreateMessage}
                disabled={modalLoading}
              >
                {modalLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.createButtonText, { fontSize: 18 * fontSizeScale }]}>{t('createMessage')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>

            {/* Audio & Video Recorder Overlay inside Create Message Modal */}
            <MediaRecorderModal
              visible={showRecorderModal}
              type={messageType === 'video' ? 'video' : 'audio'}
              onClose={() => setShowRecorderModal(false)}
              onRecordingComplete={(base64Payload) => {
                setMessageContent(base64Payload);
                Alert.alert('Başarılı', 'Medya kaydı tamamlandı ve şifreleme için hazırlandı.');
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Message Detail & Decrypt Modal */}
      <ViewMessageModal
        visible={showViewModal}
        message={selectedMessage}
        onClose={() => {
          setShowViewModal(false);
          setSelectedMessage(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: 'center',
  },
  messageCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  messageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageInfo: {
    flex: 1,
  },
  recipientName: {
    fontWeight: 'bold',
  },
  messageType: {
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 6,
  },
  dateText: {},
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  },
  modalTitle: {
    fontWeight: 'bold',
  },
  modalForm: {
    padding: 20,
  },
  encryptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 8,
  },
  encryptionBannerText: {
    flex: 1,
    lineHeight: 18,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  labelDescription: {
    marginBottom: 8,
  },
  recipientScroll: {
    marginBottom: 8,
  },
  recipientChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 2,
  },
  recipientChipText: {
    fontWeight: '600',
  },
  typeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
  },
  typeButtonText: {
    marginTop: 8,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  textArea: {
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    borderWidth: 1,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  recordingPlaceholder: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  placeholderText: {
    textAlign: 'center',
    marginTop: 16,
  },
  placeholderSubtext: {
    textAlign: 'center',
    marginTop: 8,
  },
  createButton: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deliveryModeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  deliveryModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 6,
  },
  modeText: {
    fontWeight: '600',
  },
  scheduledContainer: {
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlinePickerBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  channelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  channelChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  channelChipText: {
    fontWeight: '600',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  pickerTriggerText: {
    fontWeight: '500',
  },
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pickerModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerModalTitle: {
    fontWeight: 'bold',
  },
  pickerStepLabel: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  chipItem: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1.5,
  },
  chipText: {
    fontWeight: '600',
    fontSize: 14,
  },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pickerConfirmBtn: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerConfirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
