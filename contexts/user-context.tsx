import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useMemo, useState } from 'react';

import { AppUser, UserRole } from '../types/user';

const DEFAULT_USERS: AppUser[] = [
  { id: 'admin-1', name: 'Alex Morgan', role: 'admin' },
  { id: 'leader-1', name: 'Jordan Ray', role: 'leader' },
  { id: 'leader-2', name: 'Taylor Chen', role: 'leader' },
];

const DEFAULT_ADMIN = DEFAULT_USERS.find((user) => user.role === 'admin') ?? DEFAULT_USERS[0];

export interface UserContextValue {
  currentUser: AppUser;
  isAdmin: boolean;
  isLeader: boolean;
  availableUsers: AppUser[];
  leaders: AppUser[];
  admins: AppUser[];
  setCurrentUser: (user: AppUser) => void;
  setCurrentUserById: (userId: string) => void;
  updateUserRole: (userId: string, nextRole: UserRole) => void;
}

export const [UserProvider, useUser] = createContextHook<UserContextValue>(() => {
  const [users, setUsers] = useState<AppUser[]>(DEFAULT_USERS);
  const [currentUserId, setCurrentUserId] = useState<string>(DEFAULT_ADMIN.id);

  const currentUser = useMemo(() => {
    const activeUser = users.find((user) => user.id === currentUserId);
    return activeUser ?? users[0];
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

  const admins = useMemo(() => users.filter((user) => user.role === 'admin'), [users]);
  const leaders = useMemo(() => users.filter((user) => user.role === 'leader'), [users]);

  return {
    currentUser,
    isAdmin: currentUser.role === 'admin',
    isLeader: currentUser.role === 'leader',
    availableUsers: users,
    leaders,
    admins,
    setCurrentUser,
    setCurrentUserById,
    updateUserRole,
  };
});
