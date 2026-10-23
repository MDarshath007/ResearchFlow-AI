import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await authAPI.getProfile();
          if (res.data.success) {
            setUser(res.data.data);
          } else {
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error('Error loading user profile:', err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authAPI.login({ email, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        setUser(res.data.data);
        setLoading(false);
        return true;
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
      return false;
    }
  };

  const register = async (username, email, password, role) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authAPI.register({ username, email, password, role });
      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        setUser(res.data.data);
        setLoading(false);
        return true;
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components -- standard Context + custom hook pattern
export const useAuth = () => useContext(AuthContext);
