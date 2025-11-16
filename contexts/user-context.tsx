import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useMemo, useState } from 'react';

import { AppUser, UserRole } from '../types/user';

const DEFAULT_USERS: AppUser[] = [
  { id: 'admin-1', name: 'Alex Morgan', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { id: 'leader-1', name: 'Jordan Ray', email: 'jordan@example.com', password: 'pass123', role: 'leader' },
  { id: 'leader-2', name: 'Taylor Chen', email: 'taylor@example.com', password: 'pass123', role: 'leader' },
];

export interface UserContextValue {
  currentUser: AppUser | null;
  isAdmin: boolean;
  isLeader: boolean;
  isAuthenticated: boolean;
  availableUsers: AppUser[];
  leaders: AppUser[];
  admins: AppUser[];
  setCurrentUser: (user: AppUser) => void;
  setCurrentUserById: (userId: string) => void;
  updateUserRole: (userId: string, nextRole: UserRole) => void;
  createUser: (userData: { name: string; email: string; password: string; role: UserRole }) => AppUser;
  updateUser: (userId: string, updates: Partial<AppUser>) => void;
  getUserById: (userId: string) => AppUser | undefined;
  login: (email: string, password: string) => AppUser | null;
  signup: (name: string, email: string, password: string) => AppUser | null;
  logout: () => void;
}

export const [UserProvider, useUser] = createContextHook<UserContextValue>(() => {
  const [users, setUsers] = useState<AppUser[]>(DEFAULT_USERS);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const activeUser = users.find((user) => user.id === currentUserId);
    return activeUser ?? null;
  }, [currentUserId, users]);

  const setCurrentUser = useCallback((user: AppUser) => {
    setUsers((existing) => {
      const hasUser = existing.some((item) => item.id === user.id);
      if (hasUser) {
        return existing.map((item) => (item.id === user.id ? user : item));
      }
      return [...existing, user];
    });
    setCurrentUserId(user.id);
  }, []);

  const setCurrentUserById = useCallback((userId: string) => {
    const target = users.find((user) => user.id === userId);
    if (!target) {
      throw new Error('User not found');
    }
    setCurrentUserId(target.id);
  }, [users]);

  const updateUserRole = useCallback((userId: string, nextRole: UserRole) => {
    setUsers((existing) => {
      const targetExists = existing.some((user) => user.id === userId);
      if (!targetExists) {
        throw new Error('User not found');
      }
      return existing.map((user) =>
        user.id === userId
          ? { ...user, role: nextRole }
          : user
      );
    });
  }, []);

  const createUser = useCallback((userData: { name: string; email: string; password: string; role: UserRole }): AppUser => {
    const existingUser = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role: userData.role,
    };
    setUsers((existing) => [...existing, newUser]);
    console.log('[UserContext] Created user', { userId: newUser.id, role: newUser.role });
    return newUser;
  }, [users]);

  const updateUser = useCallback((userId: string, updates: Partial<AppUser>) => {
    setUsers((existing) => {
      const targetExists = existing.some((user) => user.id === userId);
      if (!targetExists) {
        throw new Error('User not found');
      }
      return existing.map((user) =>
        user.id === userId
          ? { ...user, ...updates }
          : user
      );
    });
    console.log('[UserContext] Updated user', { userId, updates });
  }, []);

  const getUserById = useCallback((userId: string): AppUser | undefined => {
    return users.find((user) => user.id === userId);
  }, [users]);

  const admins = useMemo(() => users.filter((user) => user.role === 'admin'), [users]);
  const leaders = useMemo(() => users.filter((user) => user.role === 'leader'), [users]);

  const login = useCallback((email: string, password: string): AppUser | null => {
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (user) {
      setCurrentUserId(user.id);
      console.log('[UserContext] User logged in', { userId: user.id, role: user.role });
      return user;
    }
    console.log('[UserContext] Login failed', { email });
    return null;
  }, [users]);

  const signup = useCallback((name: string, email: string, password: string): AppUser | null => {
    try {
      const newUser = createUser({ name, email, password, role: 'leader' });
      setCurrentUserId(newUser.id);
      console.log('[UserContext] User signed up and logged in', { userId: newUser.id });
      return newUser;
    } catch (error) {
      console.error('[UserContext] Signup failed', error);
      return null;
    }
  }, [createUser]);

  const logout = useCallback(() => {
    setCurrentUserId(null);
    console.log('[UserContext] User logged out');
  }, []);

  return {
    currentUser,
    isAdmin: currentUser?.role === 'admin',
    isLeader: currentUser?.role === 'leader',
    isAuthenticated: currentUser !== null,
    availableUsers: users,
    leaders,
    admins,
    setCurrentUser,
    setCurrentUserById,
    updateUserRole,
    createUser,
    updateUser,
    getUserById,
    login,
    signup,
    logout,
  };
});
