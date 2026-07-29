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
  Switch,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSettings } from '@/src/contexts/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { COMFORT_BUTTON_HEIGHT, COMFORT_ICON_SIZE, APP_VERSION } from '@/src/utils/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogleSession } = useAuth();
  const { 
    language, 
    fontSizeScale, 
    theme,
    comfortMode,
    colors,
    setLanguage, 
    setTheme,
    toggleComfortMode,
    increaseFontScale, 
    decreaseFontScale, 
    resetFontScale, 
    t 
  } = useSettings();
  const router = useRouter();

  const btnHeight = comfortMode ? COMFORT_BUTTON_HEIGHT : 56;
  const iconSize = comfortMode ? COMFORT_ICON_SIZE : 20;

  // Handle deep link session_id on mobile hot links
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      if (url.includes('session_id=')) {
        const sessionId = url.split('session_id=')[1].split('&')[0];
        try {
          await loginWithGoogleSession(sessionId);
          router.replace('/(tabs)/home');
        } catch (error: any) {
          Alert.alert(t('loginFailed'), error.message);
        }
      }
    });

    return () => subscription.remove();
  }, [language]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('error'), t('fieldsRequired'));
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert(t('loginFailed'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
          await loginWithGoogleSession(sessionId);
          router.replace('/(tabs)/home');
        } else {
          Alert.alert(t('loginFailed'), 'No session received');
        }
      }
    } catch (error: any) {
      Alert.alert(t('loginFailed'), error.message || 'Something went wrong');
    } finally {
      setGoogleLoading(false);
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
          {/* Settings Control Panel */}
          <View style={[styles.settingsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Language Switch */}
            <View style={styles.settingItem}>
              <Ionicons name="language-outline" size={iconSize} color={colors.iconColor} />
              <TouchableOpacity 
                onPress={() => setLanguage(language === 'en' ? 'tr' : 'en')}
                style={[styles.settingButton, { backgroundColor: colors.badgeBg }]}
              >
                <Text style={[styles.settingButtonText, { fontSize: 13 * fontSizeScale, color: colors.textPrimary }]}>
                  {language === 'en' ? 'EN 🇬🇧' : 'TR 🇹🇷'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Theme Toggle */}
            <TouchableOpacity
              onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={[styles.settingButton, { backgroundColor: colors.badgeBg }]}
            >
              <Ionicons 
                name={theme === 'dark' ? 'moon' : 'sunny'} 
                size={iconSize} 
                color={theme === 'dark' ? '#fbbf24' : '#f59e0b'} 
              />
            </TouchableOpacity>

            {/* Font Scaling Controls */}
            <View style={styles.settingItem}>
              <Ionicons name="text-outline" size={iconSize} color={colors.iconColor} />
              <TouchableOpacity onPress={decreaseFontScale} style={[styles.fontButton, { backgroundColor: colors.badgeBg }]}>
                <Text style={[styles.fontButtonText, { fontSize: 12 * fontSizeScale, color: colors.textPrimary }]}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.fontScaleText, { fontSize: 12 * fontSizeScale, color: colors.textPrimary }]}>
                {Math.round(fontSizeScale * 100)}%
              </Text>
              <TouchableOpacity onPress={increaseFontScale} style={[styles.fontButton, { backgroundColor: colors.badgeBg }]}>
                <Text style={[styles.fontButtonText, { fontSize: 12 * fontSizeScale, color: colors.textPrimary }]}>A+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetFontScale} style={[styles.resetButton, { borderColor: colors.border }]}>
                <Ionicons name="refresh-outline" size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Comfort Mode Toggle */}
          <View style={[styles.comfortModeBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.comfortModeLeft}>
              <Ionicons name="accessibility-outline" size={iconSize} color={colors.accent} />
              <View style={styles.comfortModeTextContainer}>
                <Text style={[styles.comfortModeLabel, { fontSize: 14 * fontSizeScale, color: colors.textPrimary }]}>
                  {t('comfortModeLabel')}
                </Text>
                <Text style={[styles.comfortModeDesc, { fontSize: 11 * fontSizeScale, color: colors.textMuted }]}>
                  {t('comfortModeDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={comfortMode}
              onValueChange={toggleComfortMode}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={comfortMode ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.header}>
            <Ionicons name="heart-circle" size={comfortMode ? 100 : 80} color="#ef4444" />
            <Text style={[styles.title, { fontSize: 32 * fontSizeScale, color: colors.textPrimary }]}>
              {t('loginTitle')}
            </Text>
            <Text style={[styles.subtitle, { fontSize: 16 * fontSizeScale, color: colors.textSecondary }]}>
              {t('loginSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Email Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="mail-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                testID="login-email-input"
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

            {/* Google Sign In - Text Link below email */}
            <TouchableOpacity
              testID="google-signin-link"
              onPress={handleGoogleLogin}
              disabled={googleLoading || loading}
              style={styles.googleTextLink}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <View style={styles.googleTextContainer}>
                  <Ionicons name="logo-google" size={16} color={colors.accent} />
                  <Text style={[styles.googleText, { fontSize: 14 * fontSizeScale, color: colors.accent }]}>
                    {t('continueWithGoogle')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Password Input */}
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, height: btnHeight }]}>
              <Ionicons name="lock-closed-outline" size={iconSize} color={colors.iconColor} style={styles.inputIcon} />
              <TextInput
                testID="login-password-input"
                style={[styles.input, { fontSize: 16 * fontSizeScale, color: colors.inputText }]}
                placeholder={t('passwordPlaceholder')}
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

            {/* Sign In Button */}
            <TouchableOpacity
              testID="login-submit-button"
              style={[
                styles.loginButton, 
                { backgroundColor: colors.accent, height: btnHeight },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.loginButtonText, { fontSize: 18 * fontSizeScale }]}>
                  {t('signIn')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Create Account Button - Filled style like Sign In */}
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity
                testID="go-to-register-button"
                style={[styles.createAccountButton, { backgroundColor: '#10b981', height: btnHeight }]}
              >
                <Text style={[styles.createAccountButtonText, { fontSize: 18 * fontSizeScale }]}>
                  {t('createAccount')}
                </Text>
              </TouchableOpacity>
            </Link>

            <Text style={[styles.versionText, { fontSize: 12 * fontSizeScale, color: colors.textMuted }]}>
              {APP_VERSION}
            </Text>
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
    justifyContent: 'center',
    padding: 24,
  },
  settingsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settingButtonText: {
    fontWeight: '600',
  },
  fontButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  fontButtonText: {
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  fontScaleText: {
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  comfortModeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
  },
  comfortModeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  comfortModeTextContainer: {
    flex: 1,
  },
  comfortModeLabel: {
    fontWeight: '600',
  },
  comfortModeDesc: {
    marginTop: 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    marginTop: 8,
  },
  form: {
    width: '100%',
  },
  googleTextLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  googleTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  googleText: {
    fontWeight: '500',
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
  loginButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  createAccountButton: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  createAccountButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    marginTop: 24,
    fontWeight: '500',
  },
});
