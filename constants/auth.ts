import { AppUser } from '../types/user';

export interface GoogleClientConfig {
  expo: string;
  ios: string;
  android: string;
  web: string;
}

export const GOOGLE_CLIENT_CONFIG: GoogleClientConfig = {
  expo: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};

export const ACCOUNT_PRESETS: AppUser[] = [
  { id: 'admin-1', name: 'Alex Morgan', email: 'admin.pulse@gmail.com', role: 'admin' },
  { id: 'leader-1', name: 'Jordan Ray', email: 'leader.one@gmail.com', role: 'leader' },
  { id: 'leader-2', name: 'Taylor Chen', email: 'leader.two@gmail.com', role: 'leader' },
];

export const ADMIN_EMAILS: string[] = ACCOUNT_PRESETS.filter((preset) => preset.role === 'admin').map((preset) => preset.email);
