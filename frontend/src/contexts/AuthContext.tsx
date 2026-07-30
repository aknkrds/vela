import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { storage } from '@/src/utils/storage';
import axios from 'axios';
import { configurePurchases } from '@/src/services/revenuecat';


const EXPO_PUBLIC_BACKEND_URL = (process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.velalife.tr').replace(/\/$/, '');

export const extractErrorMessage = (error: any): string => {
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;
    let detailMsg = '';
    if (data) {
      if (data.message) {
        detailMsg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      } else if (data.error) {
        detailMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else if (data.detail) {
        if (Array.isArray(data.detail)) {
          detailMsg = data.detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
        } else if (typeof data.detail === 'object') {
          detailMsg = JSON.stringify(data.detail);
        } else {
          detailMsg = String(data.detail);
        }
      } else {
        detailMsg = typeof data === 'string' ? data : JSON.stringify(data);
      }
    }
    return `[HTTP ${status}] ${detailMsg || 'Bilinmeyen Hata'}`;
  } else if (error?.request || error?.message) {
    return error.message || 'Sunucuya erişilemiyor (Network Error)';
  }
  return 'Sunucuya erişilemiyor (Network Error)';
};

interface User {
  _id?: string;
  user_id?: string;
  email: string;
  full_name: string;
  phone?: string;
  picture?: string;
  role: string;
  auth_provider?: string;
  subscription_tier: string;
  subscription_status: string;
  last_checkin?: string;
  status: string;
  created_at?: string;
  symi_points?: number;
  referral_code?: string;
  referral_eligible?: boolean;
  referrals?: any[];
  extra_recipients?: number;
  approved_requests?: any[];
  permissions?: {
    can_manage_staff?: boolean;
    can_manage_plans?: boolean;
    can_view_users?: boolean;
    can_edit_user_status?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  hasPin: boolean;
  isPinLocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone: string, referralCode?: string) => Promise<void>;
  registerWithGoogle: (sessionId: string, phone: string, password: string, referralCode?: string) => Promise<void>;
  loginWithGoogleSession: (sessionId: string) => Promise<{ is_new_user?: boolean } | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => boolean;
  removePin: () => Promise<void>;
  resetPinWithPassword: (password: string) => Promise<boolean>;
  unlockPinScreen: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [storedPin, setStoredPin] = useState<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (user && user.user_id) {
      configurePurchases(user.user_id);
    }
  }, [user]);

  const checkStoredPin = async () => {
    const pin = await storage.secureGet('app_pin', null);
    if (pin) {
      setHasPin(true);
      setStoredPin(pin);
      setIsPinLocked(true);
    } else {
      setHasPin(false);
      setStoredPin(null);
      setIsPinLocked(false);
    }
  };

  const setupPin = async (pin: string) => {
    await storage.secureSet('app_pin', pin);
    setHasPin(true);
    setStoredPin(pin);
    setIsPinLocked(false);
  };

  const verifyPin = (pin: string): boolean => {
    if (storedPin && storedPin === pin) {
      setIsPinLocked(false);
      return true;
    }
    return false;
  };

  const removePin = async () => {
    await storage.secureRemove('app_pin');
    setHasPin(false);
    setStoredPin(null);
    setIsPinLocked(false);
  };

  const unlockPinScreen = () => {
    setIsPinLocked(false);
  };

  const resetPinWithPassword = async (password: string): Promise<boolean> => {
    if (!user?.email) return false;
    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/login`, {
        email: user.email,
        password,
      });
      if (response.data && response.data.access_token) {
        await removePin();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const setAuthState = async (newToken: string, userData: User) => {
    await storage.secureSet('auth_token', newToken);
    await storage.setItem('user', userData as any);
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    await checkStoredPin();
  };

  const processSessionId = async (sessionId: string): Promise<boolean> => {
    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/google/session`, {
        session_id: sessionId,
      });
      const { session_token, user: userData } = response.data;
      await setAuthState(session_token, userData);
      return true;
    } catch (error) {
      console.error('Error processing session_id:', error);
      return false;
    }
  };

  const initializeAuth = async () => {
    try {
      await checkStoredPin();

      // On web, check URL for session_id first (from Google redirect)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const search = window.location.search;
        let sessionId: string | null = null;

        if (hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1].split('&')[0];
        } else if (search.includes('session_id=')) {
          const params = new URLSearchParams(search);
          sessionId = params.get('session_id');
        }

        if (sessionId) {
          // Clean URL
          window.history.replaceState(null, '', window.location.pathname);
          const ok = await processSessionId(sessionId);
          if (ok) {
            setIsLoading(false);
            return;
          }
        }
      }

      // On mobile cold start, check initial URL
      if (Platform.OS !== 'web') {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('session_id=')) {
          const sessionId = initialUrl.split('session_id=')[1].split('&')[0];
          const ok = await processSessionId(sessionId);
          if (ok) {
            setIsLoading(false);
            return;
          }
        }
      }

      // Check existing stored token
      const storedToken = await storage.secureGet('auth_token', null);
      if (storedToken) {
        try {
          const response = await axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          setToken(storedToken);
          setUser(response.data);
          await storage.setItem('user', response.data);
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        } catch (error) {
          // Token invalid, clear it
          await storage.secureRemove('auth_token');
          await storage.removeItem('user');
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/login`, {
        email,
        password,
      });

      const { access_token, user: userData } = response.data;
      await setAuthState(access_token, userData);
    } catch (error: any) {
      throw new Error(extractErrorMessage(error));
    }
  };

  const register = async (email: string, password: string, full_name: string, phone: string, referralCode?: string) => {
    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/register`, {
        email,
        password,
        full_name,
        phone,
        referral_code: referralCode,
      });
 
      const { access_token, user: userData } = response.data;
      await setAuthState(access_token, userData);
    } catch (error: any) {
      throw new Error(extractErrorMessage(error));
    }
  };

  const registerWithGoogle = async (sessionId: string, phone: string, password: string, referralCode?: string) => {
    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/google/register`, {
        session_id: sessionId,
        phone,
        password,
        referral_code: referralCode,
      });

      const { access_token, user: userData } = response.data;
      await setAuthState(access_token, userData);
    } catch (error: any) {
      throw new Error(extractErrorMessage(error));
    }
  };
 
  const loginWithGoogleSession = async (sessionId: string): Promise<{ is_new_user?: boolean } | null> => {
    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/google/session`, {
        session_id: sessionId,
      });
      const { session_token, user: userData, is_new_user } = response.data;
      await setAuthState(session_token, userData);
      return { is_new_user };
    } catch (error) {
      console.error('Error processing session_id:', error);
      return null;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(
          `${EXPO_PUBLIC_BACKEND_URL}/api/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    await storage.secureRemove('auth_token');
    await storage.removeItem('user');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshUser = async () => {
    try {
      if (!token) return;
      
      const response = await axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUser(response.data);
      await storage.setItem('user', response.data);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, hasPin, isPinLocked, login, register, registerWithGoogle, loginWithGoogleSession, logout, refreshUser, setupPin, verifyPin, removePin, resetPinWithPassword, unlockPinScreen, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
