import { createContext, useState, useEffect } from 'react';
import client from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const stored = sessionStorage.getItem('uips_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          // Verify with backend
          const response = await client.get('/api/auth/me');
          setUser(response.data);
          sessionStorage.setItem('uips_user', JSON.stringify(response.data));
        }
      } catch (error) {
        console.error('Auth initialization failed', error);
        sessionStorage.removeItem('uips_user');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await client.post('/api/auth/login', { email, password });
      const userData = {
        id: response.data.id,
        name: response.data.name,
        email,
        role: response.data.role
      };
      setUser(userData);
      sessionStorage.setItem('uips_user', JSON.stringify(userData));
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await client.post('/api/auth/logout');
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setUser(null);
      sessionStorage.removeItem('uips_user');
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
