import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, Check, ChevronRight, Edit, Flag, Plus, Settings, TrendingUp, UserCheck, UserPlus, Users } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  useNeedsFollowUp,
  useContactedToday,
  useSalesTeam,
} from '@/contexts/sales-team-context';
import { useUser } from '@/contexts/user-context';
import { SalesRep } from '@/types/sales-rep';

function ContactToggleButton({ rep, onPress }: { rep: SalesRep; onPress: (repId: string, currentContactedToday: boolean) => void }) {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [fillAnim] = useState(new Animated.Value(rep.contacted_today ? 1 : 0));

  const handlePress = () => {
    const newState = !rep.contacted_today;
    
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.85,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fillAnim, {
        toValue: newState ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    onPress(rep.id, rep.contacted_today);
  };

  const backgroundColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D1FAE5', '#10B981'],
  });

  const checkOpacity = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickActionButton,
        pressed && styles.quickActionButtonPressed,
      ]}
      onPress={handlePress}
      accessibilityLabel="Contacted toggle"
      accessibilityRole="button"
      accessibilityState={{ checked: rep.contacted_today }}
    >
      <Animated.View
        style={[
          styles.quickActionButtonInner,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor, borderRadius: 18 },
          ]}
        />
        <Animated.View style={{ opacity: checkOpacity }}>
          <Check size={18} color={rep.contacted_today ? '#FFFFFF' : '#10B981'} strokeWidth={3} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { isAdmin, leaders, logout } = useUser();
  const { reps, toggleContactedStatus, calculateDailyContactPercentage, calculateWeeklyContactPercentage, contactLogs } = useSalesTeam();
  const needsFollowUp = useNeedsFollowUp();
  const contactedToday = useContactedToday();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    try {
      logout();
      router.replace('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const dailyContactPercentage = useMemo(() => {
    const value = calculateDailyContactPercentage();
    const sanitized = Number.isFinite(value) ? value : 0;
    console.log('[Dashboard] Computed daily contact percentage', { sanitized });
    return sanitized;
  }, [calculateDailyContactPercentage]);

  const weeklyContactPercentage = useMemo(() => {
    const value = calculateWeeklyContactPercentage();
    const sanitized = Number.isFinite(value) ? value : 0;
    console.log('[Dashboard] Computed weekly contact percentage', { sanitized });
    return sanitized;
  }, [calculateWeeklyContactPercentage]);

  if (isAdmin) {
    return <AdminDashboardView />;
  }

  const formattedDailyPercentage = `${Math.round(dailyContactPercentage)}%`;
  const formattedWeeklyPercentage = `${Math.round(weeklyContactPercentage)}%`;

  const handleMarkContacted = async (repId: string, currentContactedToday: boolean) => {
    setError(null);
    try {
      await toggleContactedStatus(repId, currentContactedToday);
    } catch (err) {
      console.error('Failed to update contact status:', err);
      setError('Could not update. Try again');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getTimeSinceContact = (rep: SalesRep) => {
    if (rep.contacted_today) {
      return 'Contacted just now';
    }

    if (!rep.last_contacted_at) {
      return 'No contact on record';
    }

    const now = new Date();
    const lastContact = new Date(rep.last_contacted_at);
    const diffMs = now.getTime() - lastContact.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) return 'Last contact just now';
      return `Last contact ${diffHours}h ago`;
    }
    return `Last contact ${diffDays}d ago`;
  };

  const getNameColor = (rep: SalesRep) => {
    if (!rep.last_contacted_at) {
      return '#EF4444';
    }

    const now = new Date();
    const lastContact = new Date(rep.last_contacted_at);
    const diffMs = now.getTime() - lastContact.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours >= 48) {
      return '#EF4444';
    } else if (diffHours >= 24) {
      return '#D97706';
    }
    return '#111827';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Dashboard',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                { paddingHorizontal: 12, paddingVertical: 8 },
                pressed && { opacity: 0.5 },
              ]}
              testID="logout-gear-button"
            >
              <Settings size={20} color="#111827" />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.performanceRow} testID="performance-metrics">
          <View style={styles.performanceCardWrapper}>
            <LinearGradient
              colors={['#0EA5E9', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.performanceCard}
              testID="leader-daily-percentage-card"
            >
              <Text style={styles.performanceLabel}>Daily Contact Rate</Text>
              <Text style={styles.performanceValue}>{formattedDailyPercentage}</Text>
              <Text style={styles.performanceDescription}>Reps contacted today</Text>
            </LinearGradient>
          </View>
          <View style={styles.performanceCardWrapper}>
            <LinearGradient
              colors={['#10B981', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.performanceCard}
              testID="leader-weekly-percentage-card"
            >
              <Text style={styles.performanceLabel}>Weekly Reach</Text>
              <Text style={styles.performanceValue}>{formattedWeeklyPercentage}</Text>
              <Text style={styles.performanceDescription}>Reps touched in 7 days</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <TrendingUp size={24} color="#0EA5E9" />
            </View>
            <Text style={styles.statValue}>{reps.length}</Text>
            <Text style={styles.statLabel}>Total Reps</Text>
          </View>

          <View style={[styles.statCard, styles.urgentCard]}>
            <View style={[styles.statIconContainer, styles.urgentIconContainer]}>
              <AlertCircle size={24} color="#EF4444" />
            </View>
            <Text style={[styles.statValue, styles.urgentValue]}>
              {needsFollowUp.length}
            </Text>
            <Text style={styles.statLabel}>Need Follow-Up</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, styles.successIconContainer]}>
              <UserCheck size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{contactedToday.length}</Text>
            <Text style={styles.statLabel}>Contacted Today</Text>
          </View>
        </View>

        {needsFollowUp.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertCircle size={20} color="#EF4444" />
              <Text style={styles.sectionTitle}>Urgent Follow-Ups</Text>
            </View>
            <View style={styles.sectionContent}>
              {needsFollowUp.map((rep) => (
                <Pressable
                  key={rep.id}
                  style={({ pressed }) => [
                    styles.repItem,
                    pressed && styles.repItemPressed,
                  ]}
                  onPress={() => router.push(`/rep/${rep.id}`)}
                >
                  <View style={styles.repAvatar}>
                    <Text style={styles.repAvatarText}>
                      {rep.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.repInfo}>
                    <Text style={[styles.repName, { color: getNameColor(rep) }]}>{rep.name}</Text>
                    <Text style={styles.repTime}>
                      {getTimeSinceContact(rep)}
                    </Text>
                  </View>
                  {rep.todos && rep.todos.filter(t => t.status === 'open').length > 0 && (
                    <View style={styles.todoIndicator}>
                      <Flag size={14} color="#0EA5E9" fill="#0EA5E9" />
                    </View>
                  )}
                  <ContactToggleButton rep={rep} onPress={handleMarkContacted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {contactedToday.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserCheck size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Contacted Today</Text>
            </View>
            <View style={styles.sectionContent}>
              {contactedToday.map((rep) => (
                <Pressable
                  key={rep.id}
                  style={({ pressed }) => [
                    styles.repItem,
                    pressed && styles.repItemPressed,
                  ]}
                  onPress={() => router.push(`/rep/${rep.id}`)}
                >
                  <View style={styles.repAvatar}>
                    <Text style={styles.repAvatarText}>
                      {rep.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.repInfo}>
                    <Text style={[styles.repName, { color: getNameColor(rep) }]}>{rep.name}</Text>
                    <Text style={styles.repTime}>
                      {getTimeSinceContact(rep)}
                    </Text>
                  </View>
                  {rep.todos && rep.todos.filter(t => t.status === 'open').length > 0 && (
                    <View style={styles.todoIndicator}>
                      <Flag size={14} color="#0EA5E9" fill="#0EA5E9" />
                    </View>
                  )}
                  <ContactToggleButton rep={rep} onPress={handleMarkContacted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {reps.length === 0 && (
          <View style={styles.emptyState}>
            <TrendingUp size={64} color="#D1D5DB" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Welcome to Sales Team Manager</Text>
            <Text style={styles.emptyDescription}>
              Add your first sales rep to start tracking contacts and meetings
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  performanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  performanceCardWrapper: {
    flex: 1,
    minWidth: 160,
    borderRadius: 18,
    overflow: 'hidden',
  },
  performanceCard: {
    padding: 18,
    borderRadius: 18,
    minHeight: 140,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
  },
  performanceLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#E0F2FE',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  performanceValue: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  performanceDescription: {
    fontSize: 14,
    color: '#BFDBFE',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  urgentCard: {
    backgroundColor: '#FEF2F2',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  urgentIconContainer: {
    backgroundColor: '#FEE2E2',
  },
  successIconContainer: {
    backgroundColor: '#D1FAE5',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  urgentValue: {
    color: '#EF4444',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  repItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  repItemPressed: {
    backgroundColor: '#F9FAFB',
  },
  repAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  repAvatarText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
  repInfo: {
    flex: 1,
  },
  repName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 2,
  },
  repTime: {
    fontSize: 14,
    color: '#6B7280',
  },
  urgentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  quickActionButton: {
    width: 36,
    height: 36,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionButtonPressed: {
    opacity: 0.8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  todoIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  adminContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  adminScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  adminHeader: {
    marginBottom: 24,
  },
  adminTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
  },
  adminSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  leaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  leaderCardPressed: {
    backgroundColor: '#F9FAFB',
  },
  leaderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  leaderAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  leaderAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0EA5E9',
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  leaderRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  leaderStats: {
    flexDirection: 'row',
    gap: 12,
  },
  leaderStatBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  leaderStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  leaderStatValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  leaderStatValueHighlight: {
    color: '#10B981',
  },
  adminEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  adminEmptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  adminEmptyDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  headerButton: {
    padding: 4,
    marginRight: 8,
  },
  headerButtonPressed: {
    opacity: 0.6,
  },
  leaderEditButton: {
    padding: 8,
    marginRight: 4,
  },
  leaderEditButtonPressed: {
    opacity: 0.6,
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  createButton: {
    backgroundColor: '#0EA5E9',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  roleButtonActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  roleButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  leaderScoreRow: {
    marginTop: 8,
  },
  leaderScoreText: {
    fontSize: 12,
    color: '#6B7280',
  },
});

function AdminDashboardView() {
  const router = useRouter();
  const { leaders, createUser, updateUser, updateUserRole } = useUser();
  const { reps: allReps, contactLogs } = useSalesTeam();
  const [createUserModalVisible, setCreateUserModalVisible] = useState(false);
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; email: string; role: 'leader' | 'admin' } | null>(null);

  const leaderStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);

    return leaders.map((leader) => {
      const leaderReps = allReps.filter((rep) => rep.leaderId === leader.id);
      const totalReps = leaderReps.length;

      if (totalReps === 0) {
        return {
          leaderId: leader.id,
          leaderName: leader.name,
          totalReps: 0,
          repsContactedToday: 0,
          repsContactedThisWeek: 0,
          repsNotContactedThisWeek: 0,
          dailyCoveragePercent: 0,
          weeklyCoveragePercent: 0,
          weeklyConsistencyScore: 0,
        };
      }

      const leaderRepIds = new Set(leaderReps.map((rep) => rep.id));

      const leaderLogsThisWeek = contactLogs.filter((log) => {
        if (!leaderRepIds.has(log.repId)) {
          return false;
        }
        if (log.leaderId !== leader.id) {
          return false;
        }
        const timestamp = new Date(log.timestamp);
        if (Number.isNaN(timestamp.getTime())) {
          return false;
        }
        return timestamp >= weekStart;
      });

      const logsToday = contactLogs.filter((log) => {
        if (!leaderRepIds.has(log.repId)) {
          return false;
        }
        if (log.leaderId !== leader.id) {
          return false;
        }
        const timestamp = new Date(log.timestamp);
        if (Number.isNaN(timestamp.getTime())) {
          return false;
        }
        return timestamp >= todayStart;
      });

      const repsContactedTodaySet = new Set<string>();
      for (const log of logsToday) {
        repsContactedTodaySet.add(log.repId);
      }
      const repsContactedToday = repsContactedTodaySet.size;

      const repsContactedThisWeekSet = new Set<string>();
      for (const log of leaderLogsThisWeek) {
        repsContactedThisWeekSet.add(log.repId);
      }
      const repsContactedThisWeek = repsContactedThisWeekSet.size;

      const repsNotContactedThisWeek = Math.max(0, totalReps - repsContactedThisWeek);

      const repDayKeys = new Set<string>();
      for (const log of leaderLogsThisWeek) {
        const dayDate = new Date(log.timestamp);
        if (Number.isNaN(dayDate.getTime())) {
          continue;
        }
        dayDate.setHours(0, 0, 0, 0);
        const key = `${log.repId}|${dayDate.toISOString()}`;
        repDayKeys.add(key);
      }
      const repDaysContacted = repDayKeys.size;
      const repDaysTotal = totalReps * 7;
      const weeklyConsistencyScore = repDaysTotal === 0 ? 0 : Math.round((repDaysContacted / repDaysTotal) * 100);

      const dailyCoveragePercent = Math.round((repsContactedToday / totalReps) * 100);
      const weeklyCoveragePercent = Math.round((repsContactedThisWeek / totalReps) * 100);

      return {
        leaderId: leader.id,
        leaderName: leader.name,
        totalReps,
        repsContactedToday,
        repsContactedThisWeek,
        repsNotContactedThisWeek,
        dailyCoveragePercent,
        weeklyCoveragePercent,
        weeklyConsistencyScore,
      };
    });
  }, [leaders, allReps, contactLogs]);

  return (
    <View style={styles.adminContainer}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Admin Dashboard',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => setCreateUserModalVisible(true)}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.headerButtonPressed,
              ]}
            >
              <UserPlus size={24} color="#0EA5E9" />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.adminScrollContent}>
        <View style={styles.adminHeader}>
          <Text style={styles.adminTitle}>Team Leaders</Text>
          <Text style={styles.adminSubtitle}>
            {leaders.length} {leaders.length === 1 ? 'leader' : 'leaders'} managing {allReps.length} {allReps.length === 1 ? 'rep' : 'reps'}
          </Text>
        </View>

        {leaderStats.length === 0 ? (
          <View style={styles.adminEmptyState}>
            <UserCheck size={64} color="#D1D5DB" strokeWidth={1.5} />
            <Text style={styles.adminEmptyTitle}>No Leaders Yet</Text>
            <Text style={styles.adminEmptyDescription}>
              Create leader accounts to manage your sales team
            </Text>
          </View>
        ) : (
          leaderStats.map((stat) => (
            <Pressable
              key={stat.leaderId}
              style={({ pressed }) => [
                styles.leaderCard,
                pressed && styles.leaderCardPressed,
              ]}
              onPress={() => router.push(`/leader/${stat.leaderId}`)}
            >
              <View style={styles.leaderHeader}>
                <View style={styles.leaderAvatar}>
                  <Text style={styles.leaderAvatarText}>
                    {stat.leaderName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.leaderInfo}>
                  <Text style={styles.leaderName}>{stat.leaderName}</Text>
                  <Text style={styles.leaderRole}>Team Leader</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.leaderEditButton,
                    pressed && styles.leaderEditButtonPressed,
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    const leader = leaders.find(l => l.id === stat.leaderId);
                    if (leader) {
                      setEditingUser({
                        id: leader.id,
                        name: leader.name,
                        email: leader.email,
                        role: leader.role,
                      });
                      setEditUserModalVisible(true);
                    }
                  }}
                >
                  <Edit size={18} color="#6B7280" />
                </Pressable>
                <ChevronRight size={20} color="#9CA3AF" />
              </View>

              <View style={styles.leaderStats}>
                <View style={styles.leaderStatBox}>
                  <Text style={styles.leaderStatLabel}>Total Reps</Text>
                  <Text style={styles.leaderStatValue}>{stat.totalReps}</Text>
                </View>
                <View style={styles.leaderStatBox}>
                  <Text style={styles.leaderStatLabel}>Contacted This Week</Text>
                  <Text style={[styles.leaderStatValue, styles.leaderStatValueHighlight]}>
                    {stat.repsContactedThisWeek} / {stat.totalReps}
                  </Text>
                </View>
              </View>
              <View style={styles.leaderScoreRow}>
                <Text style={styles.leaderScoreText}>
                  Daily: {stat.dailyCoveragePercent}% contacted today
                </Text>
                <Text style={styles.leaderScoreText}>
                  Weekly: {stat.weeklyCoveragePercent}% contacted this week
                </Text>
                <Text style={styles.leaderScoreText}>
                  Not contacted this week: {stat.repsNotContactedThisWeek}
                </Text>
                <Text style={styles.leaderScoreText}>
                  Weekly score: {stat.weeklyConsistencyScore}/100
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={createUserModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateUserModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setCreateUserModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Leader</Text>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#9CA3AF"
                value={newUserName}
                onChangeText={setNewUserName}
              />
              <Text style={styles.fieldLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#9CA3AF"
                value={newUserEmail}
                onChangeText={setNewUserEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Temporary Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter temporary password"
                placeholderTextColor="#9CA3AF"
                value={newUserPassword}
                onChangeText={setNewUserPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setCreateUserModalVisible(false);
                    setNewUserName('');
                    setNewUserEmail('');
                    setNewUserPassword('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.createButton,
                    pressed && styles.buttonPressed,
                    (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    if (newUserName.trim() && newUserEmail.trim() && newUserPassword.trim()) {
                      try {
                        createUser({
                          name: newUserName.trim(),
                          email: newUserEmail.trim(),
                          password: newUserPassword.trim(),
                          role: 'leader',
                        });
                        setNewUserName('');
                        setNewUserEmail('');
                        setNewUserPassword('');
                        setCreateUserModalVisible(false);
                      } catch (error) {
                        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create leader');
                      }
                    }
                  }}
                  disabled={!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()}
                >
                  <Text style={styles.createButtonText}>Add Leader</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editUserModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditUserModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setEditUserModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Edit User</Text>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="#9CA3AF"
                value={editingUser?.name ?? ''}
                onChangeText={(text) => setEditingUser(prev => prev ? { ...prev, name: text } : null)}
              />
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email (optional)"
                placeholderTextColor="#9CA3AF"
                value={editingUser?.email ?? ''}
                onChangeText={(text) => setEditingUser(prev => prev ? { ...prev, email: text } : null)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.roleButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.roleButton,
                    editingUser?.role === 'leader' && styles.roleButtonActive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setEditingUser(prev => prev ? { ...prev, role: 'leader' } : null)}
                >
                  <Users size={18} color={editingUser?.role === 'leader' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.roleButtonText,
                    editingUser?.role === 'leader' && styles.roleButtonTextActive,
                  ]}>Leader</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.roleButton,
                    editingUser?.role === 'admin' && styles.roleButtonActive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setEditingUser(prev => prev ? { ...prev, role: 'admin' } : null)}
                >
                  <AlertCircle size={18} color={editingUser?.role === 'admin' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.roleButtonText,
                    editingUser?.role === 'admin' && styles.roleButtonTextActive,
                  ]}>Admin</Text>
                </Pressable>
              </View>
              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setEditUserModalVisible(false);
                    setEditingUser(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.createButton,
                    pressed && styles.buttonPressed,
                    !editingUser?.name.trim() && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    if (editingUser && editingUser.name.trim()) {
                      updateUser(editingUser.id, {
                        name: editingUser.name.trim(),
                        email: editingUser.email?.trim() || undefined,
                      });
                      if (editingUser.role) {
                        updateUserRole(editingUser.id, editingUser.role);
                      }
                      setEditingUser(null);
                      setEditUserModalVisible(false);
                    }
                  }}
                  disabled={!editingUser?.name.trim()}
                >
                  <Text style={styles.createButtonText}>Save Changes</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
