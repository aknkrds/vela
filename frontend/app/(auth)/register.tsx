import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE } from '@/src/utils/theme';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { fontSizeScale, comfortMode, colors, t } = useSettings();
  const router = useRouter();

  const btnHeight = comfortMode ? COMFORT_BUTTON_HEIGHT : 56;
  const iconSize = comfortMode ? COMFORT_ICON_SIZE : 20;

  const handleRegister = async () => {
    if (!email || !password || !fullName || !phone) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('error'), t('passwordLengthError'));
      return;
    }

    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, fullName.trim(), phone.trim(), referralCode.trim());
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert(t('registerFailed'), error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={iconSize + 4} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.title, { fontSize: 32 * fontSizeScale, color: colors.textPrimary }]}>
              {t('createAccountTitle')}
            </Text>
            <Text style={[styles.subtitle, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>
              {t('createAccountSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="person-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, color: colors.inputText }]}
                placeholder={t('fullNamePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="mail-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, color: colors.inputText }]}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="call-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, color: colors.inputText }]}
                placeholder={t('phonePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="lock-closed-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, color: colors.inputText }]}
                placeholder={t('passwordPlaceholder') + " (min 6)"}
                placeholderTextColor={colors.inputPlaceholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={iconSize}
                  color={colors.iconColor}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="gift-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontSize: 16 * fontSizeScale, color: colors.inputText }]}
                placeholder={t('referralCodePlaceholder')}
                placeholderTextColor={colors.inputPlaceholder}
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: colors.accent, height: btnHeight }, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.registerButtonText, { fontSize: 18 * fontSizeScale }]}>
                  {t('createAccountTitle')}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>
                {t('alreadyHaveAccount')}
              </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={[styles.loginLink, { fontSize: 16 * fontSizeScale, color: colors.accent }]}>
                    {t('signIn')}
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {},
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
  },
  registerButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {},
  loginLink: {
    fontWeight: '600',
  },
});
