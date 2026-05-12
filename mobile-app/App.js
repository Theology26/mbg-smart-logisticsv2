import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsProvider, useSettings } from './constants/SettingsContext';

// Screens
import LoginScreen from './screens/Auth/LoginScreen';
import TrackingScreen from './screens/Kurir/TrackingScreen';
import ScannerScreen from './screens/Dapur/ScannerScreen';
import GuruScreen from './screens/Guru/GuruScreen';

const Stack = createNativeStackNavigator();

function Navigation() {
  const { settings } = useSettings();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LoginScreen">
        <Stack.Screen 
          name="LoginScreen" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="TrackingScreen" 
          component={TrackingScreen} 
          options={{ title: settings.app_name + ' Courier', headerBackVisible: false }} 
        />
        <Stack.Screen 
          name="ScannerScreen" 
          component={ScannerScreen} 
          options={{ title: settings.app_name + ' Kitchen', headerBackVisible: false }} 
        />
        <Stack.Screen 
          name="GuruScreen" 
          component={GuruScreen} 
          options={{ title: settings.app_name + ' Guru', headerBackVisible: false }} 
        />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Navigation />
    </SettingsProvider>
  );
}
