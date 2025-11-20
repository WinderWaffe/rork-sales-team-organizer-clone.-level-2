import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ContactLog, SalesRep, Todo } from '../types/sales-rep';
import { useUser } from './user-context';

const STORAGE_KEY = 'sales_reps';
const LAST_RESET_KEY = 'last_reset_date';
const CONTACT_LOGS_KEY = 'contact_logs';
const TODOS_STORAGE_KEY = 'rep_todos';
const DEFAULT_LEADER_ASSIGNMENTS = ['leader-1', 'leader-2'];

type StoredSalesRep = Partial<SalesRep> & {
  id: string;
  name: string;
  notes?: string;
  belongs_to_leader?: string | null;
  belongsToLeader?: string | null;
  leaderId?: string | null;
  todos?: StoredTodoRecord[];
  last_contacted_at?: string | null;
  lastContactDate?: string | null;
  previous_last_contacted_at?: string | null;
  contacted_today?: boolean;
};

type StoredTodoRecord = Partial<Todo> & {
  id: string;
  title: string;
  repId?: string;
  completed?: boolean;
  status?: 'open' | 'done';
};

export interface AddRepInput {
  name: string;
  phoneNumber?: string;
  instagram?: string;
  notes?: string;
  belongsToLeader?: string | null;
  leaderId?: string | null;
}

export interface SalesTeamContextValue {
  reps: SalesRep[];
  todos: Todo[];
  contactLogs: ContactLog[];
  addRep: (repData: AddRepInput) => void;
  updateRep: (id: string, updates: Partial<SalesRep>) => void;
  deleteRep: (id: string) => void;
  updateLastContact: (id: string) => void;
  toggleContactedStatus: (id: string, currentContactedToday: boolean) => Promise<boolean>;
  addTodo: (repId: string, todoData: { title: string; description?: string; dueDate?: string }) => void;
  updateTodo: (repId: string, todoId: string, updates: Partial<Todo>) => void;
  deleteTodo: (repId: string, todoId: string) => void;
  toggleTodoStatus: (repId: string, todoId: string) => void;
  addContactLog: (repId: string, payload?: { leaderId?: string; timestamp?: string }) => void;
  deleteContactLog: (logId: string) => void;
  getTodosForRep: (repId: string) => Todo[];
  getContactLogsForRep: (repId: string) => ContactLog[];
  calculateDailyContactPercentage: () => number;
  calculateWeeklyContactPercentage: () => number;
  isLoading: boolean;
}

export const [SalesTeamProvider, useSalesTeam] = createContextHook<SalesTeamContextValue>(() => {
  const [allReps, setAllReps] = useState<SalesRep[]>([]);
  const [contactLogs, setContactLogs] = useState<ContactLog[]>([]);
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [lastResetDate, setLastResetDate] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const { currentUser, isAdmin } = useUser();

  const repsQuery = useQuery({
    queryKey: ['sales-reps'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const storedResetDate = await AsyncStorage.getItem(LAST_RESET_KEY);
      const today = new Date().toDateString();

      if (stored) {
        const parsed = JSON.parse(stored) as StoredSalesRep[];
        let migrated = parsed.map((rep) => migrateRep(rep));

        if (storedResetDate !== today) {
          migrated = migrated.map((rep) => ({
            ...rep,
            contacted_today: false,
          }));
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          await AsyncStorage.setItem(LAST_RESET_KEY, today);
          setLastResetDate(today);
        } else {
          setLastResetDate(storedResetDate);
        }

        console.log('[SalesTeam] Loaded reps from storage', migrated.length);
        return migrated;
      }

      const initialData = createSeedData();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      await AsyncStorage.setItem(LAST_RESET_KEY, today);
      setLastResetDate(today);
      console.log('[SalesTeam] Initialized seed reps', initialData.length);
      return initialData;
    },
  });

  const todosQuery = useQuery({
    queryKey: ['rep-todos'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(TODOS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredTodoRecord[];
        const migrated = parsed.map((todo) => migrateTodoRow(todo));
        console.log('[SalesTeam] Loaded todos table', migrated.length);
        return migrated;
      }
      console.log('[SalesTeam] Todos table empty, awaiting migration');
      return [];
    },
  });

  const contactLogsQuery = useQuery({
    queryKey: ['contact-logs'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(CONTACT_LOGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ContactLog[];
        console.log('[SalesTeam] Loaded contact logs table', parsed.length);
        return parsed;
      }
      console.log('[SalesTeam] Contact log table empty');
      return [];
    },
  });

  const { mutate: mutateReps } = useMutation({
    mutationFn: async (updatedReps: SalesRep[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedReps));
      return updatedReps;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-reps'] });
    },
  });

  const { mutate: mutateTodos } = useMutation({
    mutationFn: async (todos: Todo[]) => {
      await AsyncStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
      return todos;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-todos'] });
    },
  });

  const { mutate: mutateContactLogs } = useMutation({
    mutationFn: async (logs: ContactLog[]) => {
      await AsyncStorage.setItem(CONTACT_LOGS_KEY, JSON.stringify(logs));
      return logs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-logs'] });
    },
  });

  const syncReps = useCallback((updatedReps: SalesRep[]) => {
    console.log('[SalesTeam] Syncing reps', updatedReps.length);
    mutateReps(updatedReps);
  }, [mutateReps]);

  const syncTodos = useCallback((updatedTodos: Todo[]) => {
    console.log('[SalesTeam] Syncing todos table', updatedTodos.length);
    mutateTodos(updatedTodos);
  }, [mutateTodos]);

  const syncContactLogs = useCallback((updatedLogs: ContactLog[]) => {
    console.log('[SalesTeam] Syncing contact logs table', updatedLogs.length);
    mutateContactLogs(updatedLogs);
  }, [mutateContactLogs]);

  useEffect(() => {
    if (repsQuery.data) {
      setAllReps(repsQuery.data);
    }
  }, [repsQuery.data]);

  useEffect(() => {
    if (todosQuery.data) {
      const nextTodos = todosQuery.data;
      setAllTodos(nextTodos);
      setAllReps((previous) => {
        let changed = false;
        const updated = previous.map((rep) => {
          const repTodos = nextTodos.filter((todo) => todo.repId === rep.id);
          if (!areTodoListsEqual(rep.todos, repTodos)) {
            changed = true;
            return {
              ...rep,
              todos: repTodos,
            };
          }
          return rep;
        });
        if (changed) {
          syncReps(updated);
          return updated;
        }
        return previous;
      });
    }
  }, [syncReps, todosQuery.data]);

  useEffect(() => {
    if (contactLogsQuery.data) {
      setContactLogs(contactLogsQuery.data);
    }
  }, [contactLogsQuery.data]);

  useEffect(() => {
    if (!todosQuery.data || todosQuery.data.length > 0 || !repsQuery.data) {
      return;
    }
    const migrated = repsQuery.data.flatMap((rep) => rep.todos.map((todo) => ({
      ...todo,
      repId: todo.repId ?? rep.id,
      completed: typeof todo.completed === 'boolean' ? todo.completed : todo.status === 'done',
      status: todo.completed ? 'done' : todo.status,
    })));
    if (migrated.length > 0) {
      console.log('[SalesTeam] Migrating embedded todos to table', migrated.length);
      setAllTodos(migrated);
      syncTodos(migrated);
    }
  }, [repsQuery.data, syncTodos, todosQuery.data]);

  useEffect(() => {
    if (!lastResetDate) {
      return;
    }
    const checkAndResetDaily = async () => {
      const today = new Date().toDateString();
      if (lastResetDate !== today) {
        const resetReps = allReps.map((rep) => ({
          ...rep,
          contacted_today: false,
        }));
        setAllReps(resetReps);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resetReps));
        await AsyncStorage.setItem(LAST_RESET_KEY, today);
        setLastResetDate(today);
        console.log('[SalesTeam] Daily contacted status reset');
      }
    };

    const interval = setInterval(checkAndResetDaily, 60 * 1000);
    void checkAndResetDaily();

    return () => clearInterval(interval);
  }, [allReps, lastResetDate]);

  const withAuthorizedRepUpdate = useCallback((repId: string, apply: (previous: SalesRep[], target: SalesRep) => SalesRep[]) => {
    if (!currentUser) {
      console.warn('[SalesTeam] Authorization failed: no current user');
      throw new Error('You must be logged in to perform this action');
    }

    let nextState: SalesRep[] | null = null;
    let authorizationError: Error | null = null;

    setAllReps((previous) => {
      const target = previous.find((rep) => rep.id === repId);
      if (!target) {
        authorizationError = new Error('Sales rep not found');
        return previous;
      }
      if (!isAdmin && target.leaderId !== currentUser.id) {
        authorizationError = new Error('You do not have permission to modify this sales rep');
        return previous;
      }
      nextState = apply(previous, target);
      return nextState;
    });

    if (authorizationError) {
      console.warn('[SalesTeam] Authorization failed', { repId });
      throw authorizationError;
    }

    if (nextState) {
      syncReps(nextState);
    }
  }, [currentUser, isAdmin, syncReps]);

  const addRep = useCallback((repData: AddRepInput) => {
    if (!currentUser) {
      console.warn('[SalesTeam] Cannot add rep: no current user');
      throw new Error('You must be logged in to add a rep');
    }

    const now = new Date().toISOString();
    const ownerId = isAdmin ? (repData.leaderId ?? repData.belongsToLeader ?? null) : currentUser.id;

    const newRep: SalesRep = {
      id: Date.now().toString(),
      name: repData.name,
      phoneNumber: repData.phoneNumber,
      instagram: repData.instagram,
      notes: repData.notes ?? '',
      belongsToLeader: ownerId,
      leaderId: ownerId,
      lastContactDate: null,
      createdAt: now,
      last_contacted_at: null,
      previous_last_contacted_at: null,
      contacted_today: false,
      todos: [],
    };

    console.log('[SalesTeam] Adding rep', { repId: newRep.id, leaderId: ownerId });

    setAllReps((previous) => {
      const updated = [...previous, newRep];
      syncReps(updated);
      return updated;
    });
  }, [currentUser, isAdmin, syncReps]);

  const updateRep = useCallback((id: string, updates: Partial<SalesRep>) => {
    withAuthorizedRepUpdate(id, (previous) => {
      return previous.map((rep) => {
        if (rep.id !== id) {
          return rep;
        }
        const leaderIdProvided = Object.prototype.hasOwnProperty.call(updates, 'leaderId');
        const belongsFieldProvided = Object.prototype.hasOwnProperty.call(updates, 'belongsToLeader');
        
        const nextLeaderId = isAdmin
          ? (leaderIdProvided ? (updates.leaderId ?? null) : rep.leaderId)
          : rep.leaderId;
        const nextBelongsToLeader = isAdmin
          ? (belongsFieldProvided ? (updates.belongsToLeader ?? null) : nextLeaderId)
          : rep.belongsToLeader;
        
        const { belongsToLeader: _ignoredBelongsToLeader, leaderId: _ignoredLeaderId, todos: _ignoredTodos, ...restUpdates } = updates;
        const sanitizedUpdates: Partial<SalesRep> = {
          ...restUpdates,
          belongsToLeader: nextBelongsToLeader,
          leaderId: nextLeaderId,
          todos: rep.todos,
        };
        return { ...rep, ...sanitizedUpdates };
      });
    });
  }, [isAdmin, withAuthorizedRepUpdate]);

  const deleteRep = useCallback((id: string) => {
    withAuthorizedRepUpdate(id, (previous) => previous.filter((rep) => rep.id !== id));
    const remainingTodos = allTodos.filter((todo) => todo.repId !== id);
    if (remainingTodos.length !== allTodos.length) {
      setAllTodos(remainingTodos);
      syncTodos(remainingTodos);
    }
    const remainingLogs = contactLogs.filter((log) => log.repId !== id);
    if (remainingLogs.length !== contactLogs.length) {
      setContactLogs(remainingLogs);
      syncContactLogs(remainingLogs);
    }
  }, [allTodos, contactLogs, syncContactLogs, syncTodos, withAuthorizedRepUpdate]);

  const addContactLog = useCallback((repId: string, payload?: { leaderId?: string; timestamp?: string }) => {
    if (!currentUser) {
      console.warn('[SalesTeam] Cannot add contact log: no current user');
      throw new Error('You must be logged in to add a contact log');
    }

    const rep = allReps.find((item) => item.id === repId);
    if (!rep) {
      throw new Error('Sales rep not found');
    }
    const resolvedLeaderId = payload?.leaderId ?? currentUser.id;
    if (!isAdmin) {
      if (resolvedLeaderId !== currentUser.id) {
        throw new Error('Leaders can only log their own activity');
      }
      if (rep.leaderId !== currentUser.id) {
        throw new Error('You do not have permission to log activity for this sales rep');
      }
    }

    const newLog: ContactLog = {
      id: `${Date.now()}-${Math.random()}`,
      repId,
      leaderId: resolvedLeaderId,
      timestamp: payload?.timestamp ?? new Date().toISOString(),
    };

    console.log('[SalesTeam] Adding contact log', { repId, leaderId: resolvedLeaderId });

    setContactLogs((existing) => {
      const updated = [...existing, newLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      syncContactLogs(updated);
      return updated;
    });
  }, [allReps, currentUser, isAdmin, syncContactLogs]);

  const toggleContactedStatus = useCallback((id: string, currentContactedToday: boolean) => {
    return new Promise<boolean>((resolve, reject) => {
      const existingTimer = debounceTimers.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        try {
          withAuthorizedRepUpdate(id, (previous, target) => {
            let updatedRep: SalesRep;
            if (currentContactedToday) {
              updatedRep = {
                ...target,
                last_contacted_at: target.previous_last_contacted_at,
                previous_last_contacted_at: null,
                contacted_today: false,
                lastContactDate: target.previous_last_contacted_at,
              };
            } else {
              const now = new Date().toISOString();
              updatedRep = {
                ...target,
                previous_last_contacted_at: target.last_contacted_at,
                last_contacted_at: now,
                contacted_today: true,
                lastContactDate: now,
              };
              addContactLog(id);
            }
            const updated = previous.map((rep) => (rep.id === id ? updatedRep : rep));
            return updated;
          });
          resolve(true);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Unable to toggle contacted status'));
        }
        debounceTimers.current.delete(id);
      }, 400);

      debounceTimers.current.set(id, timer);
    });
  }, [addContactLog, withAuthorizedRepUpdate]);

  const updateLastContact = useCallback((id: string) => {
    withAuthorizedRepUpdate(id, (previous, target) => {
      const now = new Date().toISOString();
      const updated = previous.map((rep) => (rep.id === id ? {
        ...target,
        lastContactDate: now,
        last_contacted_at: now,
        previous_last_contacted_at: target.last_contacted_at,
        contacted_today: true,
      } : rep));
      return updated;
    });
  }, [withAuthorizedRepUpdate]);

  const addTodo = useCallback((repId: string, todoData: { title: string; description?: string; dueDate?: string }) => {
    let createdTodo: Todo | null = null;
    withAuthorizedRepUpdate(repId, (previous, target) => {
      const now = new Date().toISOString();
      const newTodo: Todo = {
        id: `${Date.now()}-${Math.random()}`,
        repId,
        title: todoData.title,
        description: todoData.description,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        dueDate: todoData.dueDate,
        completedAt: undefined,
        completed: false,
      };
      createdTodo = newTodo;

      const updated = previous.map((rep) => (rep.id === repId ? {
        ...target,
        todos: [...target.todos, newTodo],
      } : rep));

      return updated;
    });

    if (createdTodo) {
      setAllTodos((existing) => {
        const updated = [...existing, createdTodo as Todo];
        syncTodos(updated);
        return updated;
      });
    }
  }, [syncTodos, withAuthorizedRepUpdate]);

  const updateTodo = useCallback((repId: string, todoId: string, updates: Partial<Todo>) => {
    let updatedTodoRecord: Todo | null = null;
    withAuthorizedRepUpdate(repId, (previous, target) => {
      const updatedTodos = target.todos.map((todo) => {
        if (todo.id !== todoId) {
          return todo;
        }
        const nextStatus = updates.status ?? todo.status;
        const nextCompleted = updates.completed ?? (nextStatus === 'done');
        const nextCompletedAt = nextCompleted ? (updates.completedAt ?? todo.completedAt ?? new Date().toISOString()) : undefined;
        const result: Todo = {
          ...todo,
          ...updates,
          status: nextStatus,
          completed: nextCompleted,
          completedAt: nextCompletedAt,
          updatedAt: new Date().toISOString(),
        };
        updatedTodoRecord = result;
        return result;
      });

      const updated = previous.map((rep) => (rep.id === repId ? {
        ...target,
        todos: updatedTodos,
      } : rep));

      return updated;
    });

    if (updatedTodoRecord) {
      setAllTodos((existing) => {
        const updated = existing.map((todo) => (todo.id === todoId ? updatedTodoRecord as Todo : todo));
        syncTodos(updated);
        return updated;
      });
    }
  }, [syncTodos, withAuthorizedRepUpdate]);

  const deleteTodo = useCallback((repId: string, todoId: string) => {
    let removed = false;
    withAuthorizedRepUpdate(repId, (previous, target) => {
      const updatedTodos = target.todos.filter((todo) => {
        if (todo.id === todoId) {
          removed = true;
          return false;
        }
        return true;
      });
      const updated = previous.map((rep) => (rep.id === repId ? {
        ...target,
        todos: updatedTodos,
      } : rep));
      return updated;
    });

    if (removed) {
      setAllTodos((existing) => {
        const updated = existing.filter((todo) => todo.id !== todoId);
        syncTodos(updated);
        return updated;
      });
    }
  }, [syncTodos, withAuthorizedRepUpdate]);

  const toggleTodoStatus = useCallback((repId: string, todoId: string) => {
    let toggledTodo: Todo | null = null;
    withAuthorizedRepUpdate(repId, (previous, target) => {
      const updatedTodos = target.todos.map((todo) => {
        if (todo.id !== todoId) {
          return todo;
        }
        const now = new Date().toISOString();
        const isCompleted = todo.status === 'done' ? false : true;
        const nextStatus: 'open' | 'done' = isCompleted ? 'done' : 'open';
        const nextCompleted = nextStatus === 'done';
        const nextCompletedAt = nextCompleted ? now : undefined;
        const result: Todo = {
          ...todo,
          status: nextStatus,
          completed: nextCompleted,
          completedAt: nextCompletedAt,
          updatedAt: now,
        };
        toggledTodo = result;
        return result;
      });

      const updated = previous.map((rep) => (rep.id === repId ? {
        ...target,
        todos: updatedTodos,
      } : rep));

      return updated;
    });

    if (toggledTodo) {
      setAllTodos((existing) => {
        const updated = existing.map((todo) => (todo.id === todoId ? toggledTodo as Todo : todo));
        syncTodos(updated);
        return updated;
      });
    }
  }, [syncTodos, withAuthorizedRepUpdate]);

  const deleteContactLog = useCallback((logId: string) => {
    if (!currentUser) {
      console.warn('[SalesTeam] Cannot delete contact log: no current user');
      throw new Error('You must be logged in to delete a contact log');
    }

    const target = contactLogs.find((log) => log.id === logId);
    if (!target) {
      console.warn('[SalesTeam] Attempted to delete missing contact log', { logId });
      return;
    }
    if (!isAdmin && target.leaderId !== currentUser.id) {
      console.warn('[SalesTeam] Unauthorized contact log delete attempt', { logId });
      throw new Error('You do not have permission to remove this contact log');
    }

    setContactLogs((existing) => {
      const updated = existing.filter((log) => log.id !== logId);
      syncContactLogs(updated);
      console.log('[SalesTeam] Removed contact log', { logId });
      return updated;
    });
  }, [contactLogs, currentUser, isAdmin, syncContactLogs]);

  const accessibleReps = useMemo(() => {
    if (!currentUser) {
      console.log('[SalesTeam] No current user: showing no reps');
      return [];
    }
    if (isAdmin) {
      console.log('[SalesTeam] Admin access: showing all reps', allReps.length);
      return allReps;
    }
    const filtered = allReps.filter((rep) => rep.leaderId === currentUser.id);
    console.log('[SalesTeam] Leader access: filtered reps', {
      leaderId: currentUser.id,
      total: allReps.length,
      accessible: filtered.length,
    });
    return filtered;
  }, [allReps, currentUser, isAdmin]);

  const accessibleTodos = useMemo(() => {
    const allowedIds = new Set(accessibleReps.map((rep) => rep.id));
    return allTodos.filter((todo) => allowedIds.has(todo.repId));
  }, [accessibleReps, allTodos]);

  const accessibleContactLogs = useMemo(() => {
    const allowedIds = new Set(accessibleReps.map((rep) => rep.id));
    return contactLogs.filter((log) => allowedIds.has(log.repId));
  }, [accessibleReps, contactLogs]);

  const getTodosForRep = useCallback((repId: string) => {
    return accessibleTodos.filter((todo) => todo.repId === repId);
  }, [accessibleTodos]);

  const getContactLogsForRep = useCallback((repId: string) => {
    return accessibleContactLogs.filter((log) => log.repId === repId);
  }, [accessibleContactLogs]);

  const calculateDailyContactPercentage = useCallback(() => {
    const totalReps = accessibleReps.length;
    if (totalReps === 0) {
      return 0;
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const contactedRepIds = new Set<string>();
    for (const log of accessibleContactLogs) {
      const logTime = new Date(log.timestamp);
      if (Number.isNaN(logTime.getTime())) {
        continue;
      }
      if (logTime >= startOfToday) {
        contactedRepIds.add(log.repId);
      }
    }
    return (contactedRepIds.size / totalReps) * 100;
  }, [accessibleContactLogs, accessibleReps]);

  const calculateWeeklyContactPercentage = useCallback(() => {
    const totalReps = accessibleReps.length;
    if (totalReps === 0) {
      return 0;
    }
    const windowStart = new Date();
    windowStart.setHours(0, 0, 0, 0);
    windowStart.setDate(windowStart.getDate() - 6);
    const contactedRepIds = new Set<string>();
    for (const log of accessibleContactLogs) {
      const logTime = new Date(log.timestamp);
      if (Number.isNaN(logTime.getTime())) {
        continue;
      }
      if (logTime >= windowStart) {
        contactedRepIds.add(log.repId);
      }
    }
    return (contactedRepIds.size / totalReps) * 100;
  }, [accessibleContactLogs, accessibleReps]);

  return useMemo(() => ({
    reps: accessibleReps,
    todos: accessibleTodos,
    contactLogs: accessibleContactLogs,
    addRep,
    updateRep,
    deleteRep,
    updateLastContact,
    toggleContactedStatus,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodoStatus,
    addContactLog,
    deleteContactLog,
    getTodosForRep,
    getContactLogsForRep,
    calculateDailyContactPercentage,
    calculateWeeklyContactPercentage,
    isLoading: repsQuery.isLoading || todosQuery.isLoading || contactLogsQuery.isLoading,
  }), [
    accessibleContactLogs,
    accessibleReps,
    accessibleTodos,
    addContactLog,
    addRep,
    addTodo,
    calculateDailyContactPercentage,
    calculateWeeklyContactPercentage,
    contactLogsQuery.isLoading,
    deleteContactLog,
    deleteRep,
    deleteTodo,
    getContactLogsForRep,
    getTodosForRep,
    repsQuery.isLoading,
    toggleContactedStatus,
    toggleTodoStatus,
    todosQuery.isLoading,
    updateLastContact,
    updateRep,
    updateTodo,
  ]);
});

function migrateRep(rep: StoredSalesRep): SalesRep {
  const normalizedTodos = (rep.todos ?? []).map((todo) => migrateTodoRow({
    ...todo,
    repId: todo.repId ?? rep.id,
  }));

  const belongsToLeader = typeof rep.belongsToLeader === 'string'
    ? rep.belongsToLeader
    : rep.belongs_to_leader ?? null;
  
  const leaderId = rep.leaderId ?? belongsToLeader;

  return {
    id: rep.id,
    name: rep.name,
    phoneNumber: rep.phoneNumber,
    instagram: rep.instagram,
    notes: rep.notes ?? '',
    belongsToLeader,
    leaderId,
    createdAt: rep.createdAt ?? new Date().toISOString(),
    last_contacted_at: rep.last_contacted_at ?? rep.lastContactDate ?? null,
    lastContactDate: rep.lastContactDate ?? rep.last_contacted_at ?? null,
    previous_last_contacted_at: rep.previous_last_contacted_at ?? null,
    contacted_today: rep.contacted_today ?? false,
    todos: normalizedTodos,
  };
}

function migrateTodoRow(todo: StoredTodoRecord): Todo {
  const now = new Date().toISOString();
  const status = todo.status ?? (todo.completed ? 'done' : 'open');
  const completed = typeof todo.completed === 'boolean' ? todo.completed : status === 'done';
  const repId = todo.repId ?? 'unassigned';

  if (!todo.repId) {
    console.warn('[SalesTeam] Todo row missing repId during migration', { todoId: todo.id });
  }

  return {
    id: todo.id,
    repId,
    title: todo.title,
    description: todo.description,
    status,
    completed,
    createdAt: todo.createdAt ?? now,
    updatedAt: todo.updatedAt ?? now,
    dueDate: todo.dueDate,
    completedAt: completed ? (todo.completedAt ?? now) : undefined,
  };
}

function createSeedData(): SalesRep[] {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const leader1 = DEFAULT_LEADER_ASSIGNMENTS[0] ?? null;
  const leader2 = DEFAULT_LEADER_ASSIGNMENTS[1] ?? null;

  const seeds: SalesRep[] = [
    {
      id: 'seed-1',
      name: 'Quade Peacock',
      notes: '',
      belongsToLeader: leader1,
      leaderId: leader1,
      createdAt: twoHoursAgo,
      last_contacted_at: twoHoursAgo,
      lastContactDate: twoHoursAgo,
      previous_last_contacted_at: null,
      contacted_today: false,
      todos: [],
    },
    {
      id: 'seed-2',
      name: 'Kaden Morris',
      notes: '',
      belongsToLeader: leader1,
      leaderId: leader1,
      createdAt: threeDaysAgo,
      last_contacted_at: threeDaysAgo,
      lastContactDate: threeDaysAgo,
      previous_last_contacted_at: null,
      contacted_today: false,
      todos: [],
    },
    {
      id: 'seed-3',
      name: 'Justin Lundskog',
      notes: '',
      belongsToLeader: leader2,
      leaderId: leader2,
      createdAt: now,
      last_contacted_at: null,
      lastContactDate: null,
      previous_last_contacted_at: null,
      contacted_today: false,
      todos: [],
    },
  ];

  return seeds;
}

function areTodoListsEqual(existing: Todo[], nextList: Todo[]): boolean {
  if (existing.length !== nextList.length) {
    return false;
  }
  for (let index = 0; index < existing.length; index += 1) {
    const current = existing[index];
    const next = nextList[index];
    if (!next) {
      return false;
    }
    if (current.id !== next.id || current.updatedAt !== next.updatedAt || current.completed !== next.completed) {
      return false;
    }
  }
  return true;
}

export function useRepById(id: string) {
  const { reps } = useSalesTeam();
  return reps.find((rep) => rep.id === id);
}

export function useNeedsFollowUp() {
  const { reps } = useSalesTeam();
  const cutoff = useMemo(() => new Date(Date.now() - 48 * 60 * 60 * 1000), []);

  return useMemo(() => {
    return reps.filter((rep) => {
      if (!rep.last_contacted_at) {
        return true;
      }
      const lastContact = new Date(rep.last_contacted_at);
      return lastContact < cutoff;
    });
  }, [cutoff, reps]);
}

export function useContactedToday() {
  const { reps } = useSalesTeam();

  return useMemo(() => {
    const contactedToday = reps.filter((rep) => rep.contacted_today);
    return contactedToday.sort((a, b) => {
      const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [reps]);
}
