import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, ArrowLeft, Check, ChevronRight, Crown, Flag, TrendingUp, UserCheck } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSalesTeam } from '@/contexts/sales-team-context';
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
  const {
    reps,
    toggleContactedStatus,
    calculateDailyContactPercentage,
    calculateWeeklyContactPercentage,
    getRepsForLeader,
    calculateLeaderDailyContactPercentage,
    calculateLeaderWeeklyContactPercentage,
  } = useSalesTeam();
  const { currentUser, isAdmin, isLeader, leaders } = useUser();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);

  const viewingLeaderId = useMemo(() => {
    if (isAdmin) {
      return selectedLeaderId;
    }
    if (isLeader) {
      return currentUser.id;
    }
    return null;
  }, [currentUser.id, isAdmin, isLeader, selectedLeaderId]);

  const isAdminOverview = isAdmin && !viewingLeaderId;

  const viewingLeader = useMemo(() => {
    if (!viewingLeaderId) {
      return null;
    }
    return leaders.find((leader) => leader.id === viewingLeaderId) ?? null;
  }, [leaders, viewingLeaderId]);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedLeaderId(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && viewingLeaderId && !viewingLeader) {
      setSelectedLeaderId(null);
    }
  }, [isAdmin, viewingLeader, viewingLeaderId]);

  const displayReps = useMemo(() => {
    if (viewingLeaderId) {
      try {
        return getRepsForLeader(viewingLeaderId);
      } catch (err) {
        console.warn('[Dashboard] Unable to resolve reps for leader', { viewingLeaderId, error: err });
        return [];
      }
    }
    return reps;
  }, [getRepsForLeader, reps, viewingLeaderId]);

  const leaderSummaries = useMemo(() => {
    if (!isAdmin) {
      return [];
    }
    const summaries = leaders.map((leader) => {
      let repsForLeader: SalesRep[] = [];
      try {
        repsForLeader = getRepsForLeader(leader.id);
      } catch {
        repsForLeader = [];
      }
      const daily = calculateLeaderDailyContactPercentage(leader.id);
      const weekly = calculateLeaderWeeklyContactPercentage(leader.id);
      return {
        leader,
        repCount: repsForLeader.length,
        daily: Number.isFinite(daily) ? daily : 0,
        weekly: Number.isFinite(weekly) ? weekly : 0,
      };
    });
    summaries.sort((a, b) => b.weekly - a.weekly);
    return summaries;
  }, [calculateLeaderDailyContactPercentage, calculateLeaderWeeklyContactPercentage, getRepsForLeader, isAdmin, leaders]);

  const dailyContactPercentage = useMemo(() => {
    const value = viewingLeaderId
      ? calculateLeaderDailyContactPercentage(viewingLeaderId)
      : calculateDailyContactPercentage();
    const sanitized = Number.isFinite(value) ? value : 0;
    console.log('[Dashboard] Computed daily contact percentage', { sanitized, viewingLeaderId });
    return sanitized;
  }, [calculateDailyContactPercentage, calculateLeaderDailyContactPercentage, viewingLeaderId]);

  const weeklyContactPercentage = useMemo(() => {
    const value = viewingLeaderId
      ? calculateLeaderWeeklyContactPercentage(viewingLeaderId)
      : calculateWeeklyContactPercentage();
    const sanitized = Number.isFinite(value) ? value : 0;
    console.log('[Dashboard] Computed weekly contact percentage', { sanitized, viewingLeaderId });
    return sanitized;
  }, [calculateLeaderWeeklyContactPercentage, calculateWeeklyContactPercentage, viewingLeaderId]);

  const formattedDailyPercentage = `${Math.round(dailyContactPercentage)}%`;
  const formattedWeeklyPercentage = `${Math.round(weeklyContactPercentage)}%`;

  const needsFollowUp = useMemo(() => {
    if (isAdminOverview) {
      return [];
    }
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    return displayReps.filter((rep) => {
      if (!rep.last_contacted_at) {
        return true;
      }
      const lastContact = new Date(rep.last_contacted_at);
      return lastContact < cutoff;
    });
  }, [displayReps, isAdminOverview]);

  const contactedToday = useMemo(() => {
    if (isAdminOverview) {
      return [];
    }
    const contacted = displayReps.filter((rep) => rep.contacted_today);
    return contacted.sort((a, b) => {
      const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [displayReps, isAdminOverview]);

  const totalDisplayReps = displayReps.length;

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

  const handleSelectLeader = (leaderId: string) => {
    setSelectedLeaderId(leaderId);
  };

  const handleExitLeaderView = () => {
    setSelectedLeaderId(null);
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
    }
    if (diffHours >= 24) {
      return '#D97706';
    }
    return '#111827';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isAdminOverview ? 'Admin Dashboard' : 'Dashboard',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerShadowVisible: false,
        }}
      />

      {isAdminOverview ? (
        <ScrollView contentContainerStyle={styles.adminScrollContent}>
          <LinearGradient
            colors={['#0EA5E9', '#4338CA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.adminHeroCard}
            testID="admin-hero-card"
          >
            <View style={styles.adminHeroHeader}>
              <View style={styles.adminHeroIcon}>
                <Crown size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.adminHeroTitle}>Company Pulse</Text>
                <Text style={styles.adminHeroSubtitle}>Across all teams</Text>
              </View>
            </View>
            <View style={styles.adminHeroMetrics}>
              <View style={styles.adminHeroMetric}>
                <Text style={styles.adminHeroMetricLabel}>Daily</Text>
                <Text style={styles.adminHeroMetricValue}>{formattedDailyPercentage}</Text>
              </View>
              <View style={styles.adminHeroMetric}>
                <Text style={styles.adminHeroMetricLabel}>Weekly</Text>
                <Text style={styles.adminHeroMetricValue}>{formattedWeeklyPercentage}</Text>
              </View>
              <View style={styles.adminHeroMetric}>
                <Text style={styles.adminHeroMetricLabel}>Reps</Text>
                <Text style={styles.adminHeroMetricValue}>{reps.length}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.leaderListSection}>
            <Text style={styles.leaderListTitle}>Leader Insights</Text>
            {leaderSummaries.length === 0 ? (
              <View style={styles.adminEmptyState}>
                <Text style={styles.adminEmptyTitle}>No leaders yet</Text>
                <Text style={styles.adminEmptySubtitle}>Invite leaders to start tracking performance.</Text>
              </View>
            ) : (
              leaderSummaries.map((summary) => (
                <Pressable
                  key={summary.leader.id}
                  onPress={() => handleSelectLeader(summary.leader.id)}
                  style={({ pressed }) => [
                    styles.leaderCard,
                    pressed && styles.leaderCardPressed,
                  ]}
                  testID={`admin-leader-card-${summary.leader.id}`}
                >
                  <View style={styles.leaderCardHeader}>
                    <View style={styles.leaderAvatar}>
                      <Text style={styles.leaderAvatarText}>
                        {summary.leader.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.leaderInfo}>
                      <Text style={styles.leaderName}>{summary.leader.name}</Text>
                      <Text style={styles.leaderMeta}>{summary.repCount} reps</Text>
                    </View>
                    <ChevronRight size={20} color="#94A3B8" />
                  </View>
                  <View style={styles.leaderMetricsRow}>
                    <View style={styles.leaderMetricPill}>
                      <Text style={styles.leaderMetricLabel}>Daily</Text>
                      <Text style={styles.leaderMetricValue}>{`${Math.round(summary.daily)}%`}</Text>
                    </View>
                    <View style={styles.leaderMetricPill}>
                      <Text style={styles.leaderMetricLabel}>Weekly</Text>
                      <Text style={styles.leaderMetricValue}>{`${Math.round(summary.weekly)}%`}</Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isAdmin && viewingLeader && (
            <Pressable
              onPress={handleExitLeaderView}
              style={({ pressed }) => [
                styles.viewingBanner,
                pressed && styles.viewingBannerPressed,
              ]}
              testID="admin-exit-leader-view"
            >
              <ArrowLeft size={16} color="#0EA5E9" />
              <View style={styles.viewingBannerTextWrapper}>
                <Text style={styles.viewingBannerLabel}>Viewing as</Text>
                <Text style={styles.viewingBannerValue}>{viewingLeader.name}</Text>
              </View>
            </Pressable>
          )}

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
              <Text style={styles.statValue}>{totalDisplayReps}</Text>
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
                    {rep.todos && rep.todos.filter((todo) => todo.status === 'open').length > 0 && (
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
                    {rep.todos && rep.todos.filter((todo) => todo.status === 'open').length > 0 && (
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

          {totalDisplayReps === 0 && (
            <View style={styles.emptyState}>
              <TrendingUp size={64} color="#D1D5DB" strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No reps assigned yet</Text>
              <Text style={styles.emptyDescription}>
                Add a sales rep to begin tracking contact activity.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
  adminScrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 24,
  },
  adminHeroCard: {
    borderRadius: 24,
    padding: 24,
    gap: 24,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  adminHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminHeroTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  adminHeroSubtitle: {
    fontSize: 14,
    color: '#E0E7FF',
    marginTop: 4,
  },
  adminHeroMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  adminHeroMetric: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.3)',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  adminHeroMetricLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#C7D2FE',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  adminHeroMetricValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 6,
  },
  leaderListSection: {
    gap: 16,
  },
  leaderListTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  leaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 18,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  leaderCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  leaderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#4338CA',
  },
  leaderInfo: {
    flex: 1,
    marginHorizontal: 16,
  },
  leaderName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#111827',
  },
  leaderMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  leaderMetricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  leaderMetricPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  leaderMetricLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  leaderMetricValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0EA5E9',
    marginTop: 6,
  },
  adminEmptyState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  adminEmptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0F172A',
  },
  adminEmptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  viewingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  viewingBannerPressed: {
    opacity: 0.7,
  },
  viewingBannerTextWrapper: {
    flexDirection: 'column',
  },
  viewingBannerLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#0EA5E9',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  viewingBannerValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0F172A',
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
});
