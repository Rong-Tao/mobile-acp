import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { THEME, accentFor, AccentType } from './theme';
import { DATA, Server, Project } from './data/mock';
import { ServerList, AddServer } from './screens/HomeScreen';
import { ServerDetail } from './screens/ServerDetailScreen';
import { MainShell } from './screens/MainShell';

SplashScreen.preventAutoHideAsync();

const T = THEME;

type NavState =
  | { screen: 'home' }
  | { screen: 'add' }
  | { screen: 'detail'; server: Server }
  | { screen: 'main'; server: Server; project: Project };

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  const [nav, setNav] = useState<NavState>({ screen: 'home' });
  const accent: AccentType = accentFor('blue');

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg0, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accent.hue} />
      </View>
    );
  }

  const go = (next: NavState) => setNav(next);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: T.bg0 }}>
        {nav.screen === 'home' && (
          <ServerList
            accent={accent}
            onOpen={(server) => go({ screen: 'detail', server })}
            onAdd={() => go({ screen: 'add' })}
          />
        )}
        {nav.screen === 'add' && (
          <AddServer
            accent={accent}
            onBack={() => go({ screen: 'home' })}
            onPaired={() => go({ screen: 'detail', server: DATA.servers[0] })}
          />
        )}
        {nav.screen === 'detail' && (
          <ServerDetail
            server={nav.server}
            accent={accent}
            onBack={() => go({ screen: 'home' })}
            onOpenProject={(project) => go({ screen: 'main', server: nav.server, project })}
          />
        )}
        {nav.screen === 'main' && (
          <MainShell
            server={nav.server}
            project={nav.project}
            accent={accent}
            onBack={() => go({ screen: 'detail', server: nav.server })}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}
