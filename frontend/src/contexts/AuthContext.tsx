import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { storage } from '@/src/utils/storage';
import axios from 'axios';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone: string, referralCode?: string) => Promise<void>;
  loginWithGoogleSession: (sessionId: string) => Promise<{ is_new_user?: boolean } | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const setAuthState = async (newToken: string, userData: User) => {
    await storage.secureSet('auth_token', newToken);
    await storage.setItem('user', userData as any);
    setToken(newToken);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
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
      throw new Error(error.response?.data?.detail || 'Login failed');
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
      throw new Error(error.response?.data?.detail || 'Registration failed');
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
    <AuthContext.Provider value={{ user, token, login, register, loginWithGoogleSession, logout, refreshUser, isLoading }}>
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
