import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/src/contexts/SettingsContext';
import { COMFORT_ICON_SIZE } from '@/src/utils/theme';

export default function TabsLayout() {
  const { t, colors, comfortMode } = useSettings();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: comfortMode ? 72 : 60,
          paddingBottom: comfortMode ? 10 : 8,
          paddingTop: comfortMode ? 10 : 8,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: comfortMode ? 13 : 11,
          fontWeight: comfortMode ? '600' : '400',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('homeTab'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={comfortMode ? COMFORT_ICON_SIZE : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messagesTab'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail" size={comfortMode ? COMFORT_ICON_SIZE : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recipients"
        options={{
          title: t('recipientsTab'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={comfortMode ? COMFORT_ICON_SIZE : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profileTab'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={comfortMode ? COMFORT_ICON_SIZE : size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
