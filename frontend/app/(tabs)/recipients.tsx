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
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE } from '@/src/utils/theme';

interface Recipient {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  relation: string;
}

export default function Recipients() {
  const { user } = useAuth();
  const { fontSizeScale, t, colors, comfortMode } = useSettings();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  
  const btnHeight = comfortMode ? COMFORT_BUTTON_HEIGHT : 56;
  const iconSize = comfortMode ? COMFORT_ICON_SIZE : 20;

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');

  useEffect(() => {
    loadRecipients();
  }, []);

  const loadRecipients = async () => {
    try {
      const response = await api.get('/recipients');
      setRecipients(response.data);
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (recipient?: Recipient) => {
    if (recipient) {
      setEditingRecipient(recipient);
      setName(recipient.name);
      setPhone(recipient.phone);
      setEmail(recipient.email || '');
      setRelation(recipient.relation);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || !relation.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    setModalLoading(true);
    try {
      if (editingRecipient) {
        await api.put(`/recipients/${editingRecipient._id}`, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          relation: relation.trim(),
        });
        Alert.alert(t('success'), t('saveRecipientSuccess'));
      } else {
        await api.post('/recipients', {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          relation: relation.trim(),
        });
        Alert.alert(t('success'), t('saveRecipientSuccess'));
      }
      
      setShowModal(false);
      resetForm();
      loadRecipients();
    } catch (error: any) {
      Alert.alert(t('error'), error.response?.data?.detail || t('saveRecipientFailed'));
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = (recipientId: string, recipientName: string) => {
    Alert.alert(
      t('deleteRecipientTitle'),
      t('deleteRecipientConfirm').replace('{name}', recipientName),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/recipients/${recipientId}`);
              Alert.alert(t('success'), t('recipientDeletedSuccess'));
              loadRecipients();
            } catch (error: any) {
              Alert.alert(t('error'), error.response?.data?.detail || t('deleteRecipientFailed'));
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setEditingRecipient(null);
    setName('');
    setPhone('');
    setEmail('');
    setRelation('');
  };

  const getRecipientLimit = () => {
    const limits: any = {
      free: 1,
      basic: 1,
      silver: 1,
      gold: 1,
      diamond: 2,
      blue_diamond: 5,
      platinum: 25,
      galaxy: 999,
    };
    return limits[user?.subscription_tier || 'free'] || 1;
  };

  const canAddMore = recipients.length < getRecipientLimit();

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
        <View>
          <Text style={[styles.headerTitle, { fontSize: 28 * fontSizeScale, color: colors.textPrimary }]}>{t('recipientsTitle')}</Text>
          <Text style={[styles.headerSubtitle, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
            {recipients.length} / {getRecipientLimit()} {t('usedLabel')}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.addButton, 
            { backgroundColor: colors.accent, width: comfortMode ? 52 : 44, height: comfortMode ? 52 : 44, borderRadius: comfortMode ? 26 : 22 },
            !canAddMore && { backgroundColor: colors.badgeBg, opacity: 0.5 },
          ]}
          onPress={() => {
            if (!canAddMore) {
              Alert.alert(t('limitReached'), t('upgradePlanAlert'));
              return;
            }
            handleOpenModal();
          }}
          disabled={!canAddMore}
        >
          <Ionicons name="add" size={comfortMode ? 28 : 24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {recipients.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={comfortMode ? 80 : 64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>{t('noRecipientsYet')}</Text>
            <Text style={[styles.emptySubtext, { fontSize: 14 * fontSizeScale, color: colors.textMuted }]}>{t('recipientsDesc')}</Text>
          </View>
        ) : (
          recipients.map((recipient) => (
            <View key={recipient._id} style={[styles.recipientCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.recipientIcon, { backgroundColor: colors.accentDark }]}>
                <Ionicons name="person" size={comfortMode ? 28 : 24} color={colors.accent} />
              </View>
              <View style={styles.recipientInfo}>
                <Text style={[styles.recipientName, { fontSize: 18 * fontSizeScale, color: colors.textPrimary }]}>{recipient.name}</Text>
                <Text style={[styles.recipientRelation, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
                  {t('relationLabel')} {recipient.relation}
                </Text>
                <View style={styles.contactInfo}>
                  <Ionicons name="call" size={14} color={colors.textSecondary} />
                  <Text style={[styles.contactText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{recipient.phone}</Text>
                </View>
                {recipient.email && (
                  <View style={styles.contactInfo}>
                    <Ionicons name="mail" size={14} color={colors.textSecondary} />
                    <Text style={[styles.contactText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>{recipient.email}</Text>
                  </View>
                )}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenModal(recipient)}
                >
                  <Ionicons name="create-outline" size={iconSize} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDelete(recipient._id, recipient.name)}
                >
                  <Ionicons name="trash-outline" size={iconSize} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
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
              <Text style={[styles.modalTitle, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>
                {editingRecipient ? t('editRecipient') : t('addRecipient')}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('fullNamePlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText, height: btnHeight }]}
                placeholder={t('fullNamePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('phonePlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText, height: btnHeight }]}
                placeholder={t('phonePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('emailPlaceholder')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText, height: btnHeight }]}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.label, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>{t('relationLabel')}</Text>
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText, height: btnHeight }]}
                placeholder={t('relationPlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={relation}
                onChangeText={setRelation}
              />

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent, height: btnHeight }]} onPress={handleSave}>
                <Text style={[styles.saveButtonText, { fontSize: 18 * fontSizeScale }]}>{t('save')}</Text>
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
  headerSubtitle: {
    marginTop: 4,
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
  recipientCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  recipientIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontWeight: 'bold',
  },
  recipientRelation: {
    marginTop: 2,
    marginBottom: 8,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactText: {
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
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
  label: {
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  saveButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
