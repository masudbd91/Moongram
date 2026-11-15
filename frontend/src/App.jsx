import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NearbyFeed from './screens/NearbyFeed';
import PhoneVerify from './screens/Onboarding/PhoneVerify';
import SetProfile from './screens/Onboarding/SetProfile';
import { useSocket } from './hooks/useSocket';
import useAppStore from './store/useAppStore';

export default function App() {
  useSocket();
  const { authToken, isOnboarded } = useAppStore();

  let Screen = PhoneVerify;
  if (authToken) {
    Screen = isOnboarded ? NearbyFeed : SetProfile;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        <Screen />
      </View>
    </SafeAreaProvider>
  );
}
