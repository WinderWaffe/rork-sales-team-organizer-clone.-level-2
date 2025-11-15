import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ACCOUNT_PRESETS, ADMIN_EMAILS } from '../constants/auth';
import { AppUser, UserRole } from '../types/user';

const ACTIVE_USER_STORAGE_KEY = 'active_user_id';
const USER_DIRECTORY_STORAGE_KEY = 'user_directory';

interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
}

export interface UserContextValue {
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLeader: boolean;
  availableUsers: AppUser[];
  leaders: AppUser[];
  admins: AppUser[];
  isLoading: boolean;
  signInWithGoogle: (profile: GoogleProfile) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserRole: (userId: string, nextRole: UserRole) => void;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeUserRecord(user: AppUser): AppUser {
  return {
    ...user,
    email: normalizeEmail(user.email),
  };
}

function generateLeaderId(email: string): string {
  const baseEmail = normalizeEmail(email);
  const [localPart] = baseEmail.split('@');
  const sanitized = localPart.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (sanitized.length === 0) {
    return `leader-${Date.now().toString()}`;
  }
  return `leader-${sanitized}`;
}

function mergeUsers(candidates: AppUser[]): AppUser[] {
  const registry = new Map<string, AppUser>();
  const presetEmails = new Set(ACCOUNT_PRESETS.map((preset) => normalizeEmail(preset.email)));
  candidates.forEach((candidate) => {
    const sanitized = sanitizeUserRecord(candidate);
    const key = sanitized.email;
    const existing = registry.get(key);
    if (!existing) {
      registry.set(key, sanitized);
      return;
    }
    if (presetEmails.has(key)) {
      registry.set(key, { ...existing, ...sanitized, id: existing.id });
      return;
    }
    registry.set(key, sanitized);
  });
  const values = Array.from(registry.values());
  values.sort((a, b) => a.name.localeCompare(b.name));
  return values;
}

const PRESET_USERS = mergeUsers(ACCOUNT_PRESETS);
const PRESET_MAP = new Map<string, AppUser>(PRESET_USERS.map((user) => [user.email, user]));
const ADMIN_EMAIL_SET = new Set<string>(ADMIN_EMAILS.map((email) => normalizeEmail(email)));

function resolveSignIn(users: AppUser[], profile: GoogleProfile): { resolvedUser: AppUser; list: AppUser[] } {
  const normalizedEmail = normalizeEmail(profile.email);
  const existing = users.find((user) => normalizeEmail(user.email) === normalizedEmail);
  if (existing) {
    const updated: AppUser = {
      ...existing,
      name: profile.name || existing.name,
      email: normalizedEmail,
      avatarUrl: profile.picture ?? existing.avatarUrl,
    };
    const nextList = mergeUsers([
      ...users.filter((user) => user.id !== existing.id),
      updated,
    ]);
    return { resolvedUser: updated, list: nextList };
  }
  const preset = PRESET_MAP.get(normalizedEmail);
  if (preset) {
    const merged: AppUser = {
      ...preset,
      name: profile.name || preset.name,
      email: normalizedEmail,
      avatarUrl: profile.picture ?? preset.avatarUrl,
    };
    const nextList = mergeUsers([...users, merged]);
    return { resolvedUser: merged, list: nextList };
  }
  if (ADMIN_EMAIL_SET.has(normalizedEmail)) {
    console.warn('[UserContext] Blocked unauthorized admin login attempt', { email: normalizedEmail });
    throw new Error('Admin access restricted');
  }
  const generated: AppUser = {
    id: generateLeaderId(normalizedEmail),
    name: profile.name || profile.email.split('@')[0] || 'New Leader',
    email: normalizedEmail,
    role: 'leader',
    avatarUrl: profile.picture,
  };
  const nextList = mergeUsers([...users, generated]);
  return { resolvedUser: generated, list: nextList };
}

export const [UserProvider, useUser] = createContextHook<UserContextValue>(() => {
  const [users, setUsers] = useState<AppUser[]>(PRESET_USERS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const persistUserDirectory = useCallback(async (nextUsers: AppUser[]) => {
    try {
      await AsyncStorage.setItem(USER_DIRECTORY_STORAGE_KEY, JSON.stringify(nextUsers));
      console.log('[UserContext] Persisted user directory', nextUsers.length);
    } catch (error) {
      console.error('[UserContext] Failed to persist user directory', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        console.log('[UserContext] Restoring session from storage');
        const [directoryJson, activeUserId] = await Promise.all([
          AsyncStorage.getItem(USER_DIRECTORY_STORAGE_KEY),
          AsyncStorage.getItem(ACTIVE_USER_STORAGE_KEY),
        ]);
        let directory = PRESET_USERS;
        if (directoryJson) {
          const parsed = JSON.parse(directoryJson) as AppUser[];
          directory = mergeUsers([...PRESET_USERS, ...parsed]);
        }
        if (isMounted) {
          setUsers(directory);
          if (activeUserId) {
            const found = directory.find((user) => user.id === activeUserId);
            if (found) {
              setCurrentUserId(found.id);
            }
          }
        }
      } catch (error) {
        console.error('[UserContext] Failed to restore session', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentUser = useMemo(() => {
    if (!currentUserId) {
      return null;
    }
    const activeUser = users.find((user) => user.id === currentUserId);
    return activeUser ?? null;
  }, [currentUserId, users]);

  const signInWithGoogle = useCallback(async (profile: GoogleProfile) => {
    try {
      console.log('[UserContext] Attempting Google sign-in', { email: profile.email });
      const result = resolveSignIn(users, profile);
      setUsers(result.list);
      setCurrentUserId(result.resolvedUser.id);
      await Promise.all([
        AsyncStorage.setItem(ACTIVE_USER_STORAGE_KEY, result.resolvedUser.id),
        persistUserDirectory(result.list),
      ]);
      console.log('[UserContext] Google sign-in success', { userId: result.resolvedUser.id, role: result.resolvedUser.role });
    } catch (error) {
      console.error('[UserContext] Google sign-in failed', error);
      throw error;
    }
  }, [persistUserDirectory, users]);

  const signOut = useCallback(async () => {
    try {
      console.log('[UserContext] Signing out current user');
      setCurrentUserId(null);
      await AsyncStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    } catch (error) {
      console.error('[UserContext] Failed to sign out', error);
    }
  }, []);

  const updateUserRole = useCallback((userId: string, nextRole: UserRole) => {
    setUsers((existing) => {
      const targetExists = existing.some((user) => user.id === userId);
      if (!targetExists) {
        throw new Error('User not found');
      }
      const updated = existing.map((user) => (user.id === userId ? { ...user, role: nextRole } : user));
      void persistUserDirectory(updated);
      return updated;
    });
  }, [persistUserDirectory]);

  const admins = useMemo(() => users.filter((user) => user.role === 'admin'), [users]);
  const leaders = useMemo(() => users.filter((user) => user.role === 'leader'), [users]);

  return useMemo(() => ({
    currentUser,
    isAuthenticated: currentUser !== null,
    isAdmin: currentUser?.role === 'admin',
    isLeader: currentUser?.role === 'leader',
    availableUsers: users,
    leaders,
    admins,
    isLoading,
    signInWithGoogle,
    signOut,
    updateUserRole,
  }), [admins, currentUser, isLoading, leaders, signInWithGoogle, signOut, updateUserRole, users]);
});
