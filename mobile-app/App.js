import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import LoginScreen from './screens/Auth/LoginScreen';
import TrackingScreen from './screens/Kurir/TrackingScreen';
import ScannerScreen from './screens/Dapur/ScannerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
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
          options={{ title: 'Kurir Tracker', headerBackVisible: false }} 
        />
        <Stack.Screen 
          name="ScannerScreen" 
          component={ScannerScreen} 
          options={{ title: 'Dapur Scanner', headerBackVisible: false }} 
        />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
