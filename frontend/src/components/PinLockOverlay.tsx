import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';

export const PinLockOverlay: React.FC = () => {
  const { hasPin, isPinLocked, verifyPin, resetPinWithPassword, user } = useAuth();
  const { colors, t, fontSizeScale } = useSettings();
  
  const [pinInput, setPinInput] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!hasPin || !isPinLocked || !user) {
    return null;
  }

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 8) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
    }
  };

  const handleDelete = () => {
    setPinInput(pinInput.slice(0, -1));
  };

  const handleUnlock = () => {
    if (!verifyPin(pinInput)) {
      Alert.alert(t('error'), t('invalidPin'));
      setPinInput('');
    } else {
      setPinInput('');
    }
  };

  const handleResetPinSubmit = async () => {
    if (!passwordInput.trim()) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    setLoading(true);
    try {
      const success = await resetPinWithPassword(passwordInput);
      if (success) {
        setShowResetModal(false);
        setPasswordInput('');
        setPinInput('');
        Alert.alert(t('success'), t('pinResetSuccessAlert'));
      } else {
        Alert.alert(t('error'), t('invalidPasswordError'));
      }
    } catch (e) {
      Alert.alert(t('error'), t('invalidPasswordError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={isPinLocked} animationType="fade" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Ionicons name="lock-closed" size={64} color={colors.accent} />
          <Text style={[styles.title, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>
            {t('appPinSection')}
          </Text>
          <Text style={[styles.subtitle, { fontSize: 15 * fontSizeScale, color: colors.textSecondary }]}>
            {t('enterPin')}
          </Text>
        </View>

        {/* PIN Display Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3, 4, 5, 6, 7].slice(0, Math.max(4, pinInput.length)).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: colors.border, backgroundColor: colors.surface },
                i < pinInput.length && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
            />
          ))}
        </View>

        {/* Number Keypad */}
        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.keyButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleKeyPress(num)}
                >
                  <Text style={[styles.keyText, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
              onPress={() => setShowResetModal(true)}
            >
              <Ionicons name="help-circle-outline" size={28} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleKeyPress('0')}
            >
              <Text style={[styles.keyText, { fontSize: 24 * fontSizeScale, color: colors.textPrimary }]}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyButton, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
              onPress={handleDelete}
            >
              <Ionicons name="backspace-outline" size={28} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Unlock Button */}
        <TouchableOpacity
          style={[styles.unlockButton, { backgroundColor: colors.accent }]}
          onPress={handleUnlock}
          disabled={pinInput.length < 4}
        >
          <Text style={[styles.unlockText, { fontSize: 18 * fontSizeScale }]}>{t('unlockApp')}</Text>
        </TouchableOpacity>

        {/* Reset PIN Option */}
        <TouchableOpacity onPress={() => setShowResetModal(true)} style={styles.resetLink}>
          <Text style={[styles.resetLinkText, { fontSize: 14 * fontSizeScale, color: colors.accent }]}>
            {t('resetPin')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Password Verification Modal for PIN Reset */}
      <Modal visible={showResetModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.resetModalContainer, { backgroundColor: colors.modalOverlay }]}
        >
          <View style={[styles.resetModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.resetModalHeader}>
              <Text style={[styles.resetModalTitle, { fontSize: 20 * fontSizeScale, color: colors.textPrimary }]}>
                {t('resetPin')}
              </Text>
              <TouchableOpacity onPress={() => setShowResetModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.resetModalText, { fontSize: 14 * fontSizeScale, color: colors.textSecondary }]}>
              {t('enterPasswordToResetPin')}
            </Text>

            <TextInput
              style={[
                styles.passwordInput,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText },
              ]}
              placeholder={t('passwordPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.confirmResetButton, { backgroundColor: colors.danger }]}
              onPress={handleResetPinSubmit}
              disabled={loading}
            >
              <Text style={[styles.confirmResetText, { fontSize: 16 * fontSizeScale }]}>{t('resetPin')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    marginTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  keypad: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
    marginBottom: 32,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  keyText: {
    fontWeight: 'bold',
  },
  unlockButton: {
    width: '100%',
    maxWidth: 300,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  resetLink: {
    marginTop: 20,
    padding: 10,
  },
  resetLinkText: {
    fontWeight: '600',
  },
  resetModalContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  resetModalContent: {
    borderRadius: 16,
    padding: 24,
  },
  resetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resetModalTitle: {
    fontWeight: 'bold',
  },
  resetModalText: {
    marginBottom: 16,
  },
  passwordInput: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  confirmResetButton: {
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmResetText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
