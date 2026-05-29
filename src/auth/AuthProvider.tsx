import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getErrorMessage } from '@/api/client';
import { getAnonId, initAnonId } from '@/api/anon';
import type { Account } from '@/api/types';

interface AuthContextType {
  account: Account | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  requestMagicLink: (
    email: string,
    intent: 'login' | 'signup' | 'add-email-to-account',
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  triggerOAuth: (provider: 'google' | 'github') => void;
  updateProfile: (body: {
    display_name?: string;
    avatar_seed?: string;
    bio?: string;
    likes_public?: boolean;
    follows_public?: boolean;
  }) => Promise<Account>;
  claimCurrentDevice: () => Promise<{ success: boolean }>;
  unclaimDevice: (anonId: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    // Hydrate anonymous ID from platform storage before checking session
    try {
      await initAnonId();
    } catch (e) {
      console.error('Failed to initialize anonymous ID:', e);
    }

    if (!api.isBackendConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.session();
      setAccount(res.account);
    } catch (err) {
      console.error('Failed to fetch auth session:', err);
      setError(getErrorMessage(err, 'Failed to load authentication session.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const requestMagicLink = async (
    email: string,
    intent: 'login' | 'signup' | 'add-email-to-account',
  ) => {
    setError(null);
    try {
      await api.requestMagicLink(email, intent);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to request verification link.'));
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await api.logout();
      setAccount(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to logout.'));
      throw err;
    }
  };

  const triggerOAuth = (provider: 'google' | 'github') => {
    const apiBase = import.meta.env.VITE_API_BASE ?? '';
    // Redirect to the server OAuth entry point
    const redirectUrl = `${apiBase.replace(/\/$/, '')}/api/v1/auth/oauth/${provider}/start`;
    window.location.href = redirectUrl;
  };

  const updateProfile = async (body: {
    display_name?: string;
    avatar_seed?: string;
    bio?: string;
    likes_public?: boolean;
    follows_public?: boolean;
  }) => {
    setError(null);
    try {
      const res = await api.updateProfile(body);
      setAccount(res);
      return res;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update profile.'));
      throw err;
    }
  };

  const claimCurrentDevice = async (): Promise<{ success: boolean }> => {
    setError(null);
    const anonId = getAnonId();
    if (!anonId) {
      throw new Error('No guest ID available to claim.');
    }
    try {
      const res = await api.claimAnonId(anonId);
      return res;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to claim device content.'));
      throw err;
    }
  };

  const unclaimDevice = async (anonId: string) => {
    setError(null);
    try {
      await api.unclaimAnonId(anonId);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to unclaim device.'));
      throw err;
    }
  };

  const clearError = () => setError(null);

  const isAuthenticated = !!account;

  return (
    <AuthContext.Provider
      value={{
        account,
        isAuthenticated,
        loading,
        error,
        requestMagicLink,
        logout,
        refreshSession,
        triggerOAuth,
        updateProfile,
        claimCurrentDevice,
        unclaimDevice,
        clearError,
      }}
    >
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
