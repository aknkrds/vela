import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../contexts/SettingsContext';
import { SupportedLanguage } from '../contexts/SettingsContext';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어', flag: '🇰🇷' },
];

interface LanguageSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  visible,
  onClose,
}) => {
  const { language, setLanguage, colors, fontSizeScale, t } = useSettings();

  const handleSelect = async (code: SupportedLanguage) => {
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name="globe-outline" size={22} color={colors.accent} />
                  <Text
                    style={[
                      styles.title,
                      {
                        color: colors.textPrimary,
                        fontSize: 18 * fontSizeScale,
                      },
                    ]}
                  >
                    {t('languageLabel') || 'Language / Dil'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
                {LANGUAGES.map((item) => {
                  const isSelected = language === item.code;
                  return (
                    <TouchableOpacity
                      key={item.code}
                      style={[
                        styles.languageItem,
                        {
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? (colors.badgeBg || '#1e293b') : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelect(item.code)}
                    >
                      <View style={styles.itemLeft}>
                        <Text style={styles.flag}>{item.flag}</Text>
                        <View style={styles.labelContainer}>
                          <Text
                            style={[
                              styles.nativeLabel,
                              {
                                color: isSelected ? colors.accent : colors.textPrimary,
                                fontSize: 16 * fontSizeScale,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {item.nativeLabel}
                          </Text>
                          <Text
                            style={[
                              styles.subLabel,
                              {
                                color: colors.textMuted,
                                fontSize: 12 * fontSizeScale,
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  languageList: {
    maxHeight: 380,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flag: {
    fontSize: 26,
  },
  labelContainer: {
    justifyContent: 'center',
  },
  nativeLabel: {},
  subLabel: {
    marginTop: 1,
  },
});
