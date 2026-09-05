import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  isPlatformAdmin: boolean;
}

interface AuthState {
  authenticated: boolean;
  user: User | null;
}

interface AuthContextType extends AuthState {
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  // Fetch session state from backend
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiClient.get<AuthState>('/auth/me');
      return res.data;
    },
    retry: false, // Don't retry on 401
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const authState = data || { authenticated: false, user: null };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      queryClient.setQueryData(['auth', 'me'], { authenticated: false, user: null });
      window.location.href = '/login';
    }
  };

  // Listen for global 401s from the Axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.setQueryData(['auth', 'me'], { authenticated: false, user: null });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [queryClient]);

  // If the query errors out (e.g. 401), we consider them unauthenticated
  const isAuthenticated = !error && authState.authenticated;

  return (
    <AuthContext.Provider value={{ ...authState, authenticated: isAuthenticated, isLoading, logout }}>
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
