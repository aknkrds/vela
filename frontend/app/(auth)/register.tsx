import { useState, useEffect } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE } from '@/src/utils/theme';

export default function Register() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const { register, registerWithGoogle, loginWithGoogleSession } = useAuth();
  const { fontSizeScale, comfortMode, colors, t } = useSettings();
  const router = useRouter();

  const btnHeight = comfortMode ? COMFORT_BUTTON_HEIGHT : 56;
  const iconSize = comfortMode ? COMFORT_ICON_SIZE : 20;

  // Handle deep link for Google auth callback
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url.includes('session_id=')) {
        const sessionId = url.split('session_id=')[1].split('&')[0];
        try {
          const result = await loginWithGoogleSession(sessionId);
          if (result && result.is_new_user) {
            // New user from Google - need phone and password
            // The user info is already saved, redirect to complete profile
            router.replace('/(tabs)/home');
          } else {
            // Existing user - just log in
            router.replace('/(tabs)/home');
          }
        } catch (error: any) {
          Alert.alert(t('registerFailed'), error.message);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      let redirectUrl: string;
      
      if (Platform.OS === 'web') {
        redirectUrl = window.location.origin + '/';
      } else {
        redirectUrl = Linking.createURL('');
      }

      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = authUrl;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        if (result.url.includes('session_id=')) {
          const sessionId = result.url.split('session_id=')[1].split('&')[0];
          const loginResult = await loginWithGoogleSession(sessionId);
          if (loginResult) {
            router.replace('/(tabs)/home');
          } else {
            Alert.alert(t('registerFailed'), 'Google sign-up failed');
          }
        } else {
          Alert.alert(t('registerFailed'), 'No session received');
        }
      }
    } catch (error: any) {
      Alert.alert(t('registerFailed'), error.message || 'Something went wrong');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleContinueToStep2 = () => {
    if (!fullName || !email) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }
    setStep(2);
  };

  const handleRegister = async () => {
    if (!phone || !password) {
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

  const renderStep1 = () => (
    <>
      {/* Google Sign Up Button - At top */}
      <TouchableOpacity
        testID="google-signup-button"
        style={[
          styles.googleButton,
          { backgroundColor: colors.googleBtnBg, height: btnHeight },
          googleLoading && styles.buttonDisabled,
        ]}
        onPress={handleGoogleSignUp}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          <ActivityIndicator color={colors.googleBtnText} />
        ) : (
          <>
            <Ionicons name="logo-google" size={comfortMode ? 26 : 22} color={colors.googleBtnText} />
            <Text style={[styles.googleButtonText, { fontSize: 16 * fontSizeScale, color: colors.googleBtnText }]}>
              {t('googleSignUp')}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: colors.dividerLine }]} />
        <Text style={[styles.dividerText, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>
          {t('orContinueWithEmail')}
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.dividerLine }]} />
      </View>

      {/* Full Name Input */}
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

      {/* Email Input */}
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

      {/* Continue Button */}
      <TouchableOpacity
        testID="register-continue-button"
        style={[styles.continueButton, { backgroundColor: colors.accent, height: btnHeight }]}
        onPress={handleContinueToStep2}
        disabled={loading}
      >
        <Text style={[styles.continueButtonText, { fontSize: 18 * fontSizeScale }]}>
          {t('continue')}
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      {/* Step indicator */}
      <View style={[styles.stepInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="person-circle-outline" size={24} color={colors.accent} />
        <View style={styles.stepInfoText}>
          <Text style={[styles.stepUserName, { fontSize: 16 * fontSizeScale, color: colors.textPrimary }]}>
            {fullName}
          </Text>
          <Text style={[styles.stepUserEmail, { fontSize: 13 * fontSizeScale, color: colors.textMuted }]}>
            {email}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.stepEditButton}>
          <Ionicons name="pencil-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Phone Input */}
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

      {/* Password Input */}
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

      {/* Referral Code Input */}
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

      {/* Register Button */}
      <TouchableOpacity
        testID="register-submit-button"
        style={[styles.registerButton, { backgroundColor: '#10b981', height: btnHeight }, loading && styles.buttonDisabled]}
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
    </>
  );

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
            <TouchableOpacity onPress={() => step === 2 ? setStep(1) : router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={iconSize + 4} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { fontSize: 32 * fontSizeScale, color: colors.textPrimary }]}>
                {t('createAccountTitle')}
              </Text>
              <View style={[styles.stepBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.stepBadgeText, { fontSize: 12 * fontSizeScale }]}>
                  {step === 1 ? t('step1of2') : t('step2of2')}
                </Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>
              {t('createAccountSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            {step === 1 ? renderStep1() : renderStep2()}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepBadgeText: {
    color: '#fff',
    fontWeight: '600',
  },
  subtitle: {},
  form: {
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 12,
    marginBottom: 8,
  },
  googleButtonText: {
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
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
  continueButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  stepInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  stepInfoText: {
    flex: 1,
  },
  stepUserName: {
    fontWeight: '600',
  },
  stepUserEmail: {},
  stepEditButton: {
    padding: 8,
  },
  registerButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
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
