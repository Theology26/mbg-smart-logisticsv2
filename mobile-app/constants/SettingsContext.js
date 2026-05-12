import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_CONFIG } from './config';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    app_name: 'MBG Logistics',
    theme_color: '#3b82f6',
    enable_ai_menu: 'true',
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/settings`);
      const data = await response.json();
      if (data.status === 200) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
