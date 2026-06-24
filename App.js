import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScanScreen from './src/screens/ScanScreen';
import DeviceScreen from './src/screens/DeviceScreen';

const Stack = createNativeStackNavigator();

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0a0a0a',
    card: '#111',
    text: '#fff',
    border: '#222',
    primary: '#00ff99',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#00ff99',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ title: '⌚ Watch Reset Tool', headerShown: false }}
        />
        <Stack.Screen
          name="Device"
          component={DeviceScreen}
          options={({ route }) => ({
            title: route.params?.deviceName || 'Device',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
