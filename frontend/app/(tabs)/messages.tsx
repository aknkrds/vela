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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { encryptMessage, hashPassword } from '@/src/utils/encryption';
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE } from '@/src/utils/theme';

interface Message {
  _id: string;
  message_type: string;
  recipient_name: string;
  created_at: string;
  is_delivered: boolean;
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [messagesRes, recipientsRes] = await Promise.all([
        api.get('/messages'),
        api.get('/recipients'),
      ]);
      setMessages(messagesRes.data);
      setRecipients(recipientsRes.data);
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
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

    setModalLoading(true);
    try {
      // Client-side encryption: encrypt the message before sending
      const encryptedContent = encryptMessage(messageContent, encryptionPassword);
      // Hash the password — backend will never see the raw password
      const passwordHash = hashPassword(encryptionPassword);

      await api.post('/messages', {
        recipient_id: selectedRecipient,
        message_type: messageType,
        content: encryptedContent,
        encryption_password: passwordHash,
      });
      
      Alert.alert(t('success'), t('createMessageSuccess'));
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('createMessageFailed'));
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
          onPress={() => {
            if (recipients.length === 0) {
              Alert.alert(t('error'), t('addRecipient'));
              return;
            }
            setShowModal(true);
          }}
        >
          <Ionicons name="add" size={comfortMode ? 28 : 24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={comfortMode ? 80 : 64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>{t('noMessagesYet')}</Text>
            <Text style={[styles.emptySubtext, { fontSize: 14 * fontSizeScale, color: colors.textMuted }]}>{t('messagesDesc')}</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View key={message._id} style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                    name={message.is_delivered ? 'checkmark-circle' : 'lock-closed'}
                    size={comfortMode ? 20 : 16}
                    color={message.is_delivered ? colors.success : colors.textMuted}
                  />
                  <Text style={[styles.statusText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
                    {message.is_delivered ? 'Delivered' : t('messageEncrypted')}
                  </Text>
                </View>
                <Text style={[styles.dateText, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>
                  {new Date(message.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
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
                <View style={[styles.recordingPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="mic" size={48} color={colors.textMuted} />
                  <Text style={[styles.placeholderText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
                    {messageType === 'audio' ? 'Audio' : 'Video'} recording will be available in the next update
                  </Text>
                  <Text style={[styles.placeholderSubtext, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>For now, please use text messages</Text>
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
                  (modalLoading || messageType !== 'text') && { backgroundColor: colors.badgeBg },
                ]}
                onPress={handleCreateMessage}
                disabled={modalLoading || messageType !== 'text'}
              >
                {modalLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.createButtonText, { fontSize: 18 * fontSizeScale }]}>{t('createMessage')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
});
