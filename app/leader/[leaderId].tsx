import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, ArrowLeft, BookUser, Check, ChevronLeft, Flag, Instagram, Plus, Settings, TrendingUp, UserCheck, UserCircle } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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

export default function LeaderViewScreen() {
  const { leaderId } = useLocalSearchParams<{ leaderId: string }>();
  const { getUserById, isAdmin } = useUser();
  const { reps, addRep, updateRep, deleteRep, toggleContactedStatus } = useSalesTeam();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newRepName, setNewRepName] = useState('');
  const [newRepPhone, setNewRepPhone] = useState('');
  const [newRepInstagram, setNewRepInstagram] = useState('');
  const [newRepNotes, setNewRepNotes] = useState('');
  const [editingRep, setEditingRep] = useState<{ id: string; name: string; phoneNumber?: string; instagram?: string; notes?: string } | null>(null);

  const leader = getUserById(leaderId ?? '');

  const leaderReps = useMemo(() => {
    if (!leaderId) return [];
    return reps.filter((rep) => rep.leaderId === leaderId);
  }, [reps, leaderId]);

  const needsFollowUp = useMemo(() => {
    return leaderReps.filter((rep) => {
      if (!rep.last_contacted_at) return true;
      const now = new Date();
      const lastContact = new Date(rep.last_contacted_at);
      const hoursSince = (now.getTime() - lastContact.getTime()) / (1000 * 60 * 60);
      return hoursSince >= 48;
    });
  }, [leaderReps]);

  const contactedToday = useMemo(() => {
    return leaderReps.filter((rep) => rep.contacted_today);
  }, [leaderReps]);

  const calculateDailyContactPercentage = useMemo(() => {
    if (leaderReps.length === 0) return 0;
    const contacted = leaderReps.filter((rep) => rep.contacted_today).length;
    return (contacted / leaderReps.length) * 100;
  }, [leaderReps]);

  const calculateWeeklyContactPercentage = useMemo(() => {
    if (leaderReps.length === 0) return 0;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const contactedInWeek = leaderReps.filter((rep) => {
      if (!rep.last_contacted_at) return false;
      const lastContact = new Date(rep.last_contacted_at);
      return lastContact >= weekStart;
    }).length;
    return (contactedInWeek / leaderReps.length) * 100;
  }, [leaderReps]);

  const handleAddRep = () => {
    if (newRepName.trim() && leaderId) {
      let instagramHandle = newRepInstagram.trim();
      if (instagramHandle && !instagramHandle.startsWith('@')) {
        instagramHandle = '@' + instagramHandle;
      }
      addRep({
        name: newRepName.trim(),
        phoneNumber: newRepPhone.trim() || undefined,
        instagram: instagramHandle || undefined,
        notes: newRepNotes.trim() || undefined,
        leaderId,
      });
      setNewRepName('');
      setNewRepPhone('');
      setNewRepInstagram('');
      setNewRepNotes('');
      setModalVisible(false);
    }
  };

  const handleEditRep = () => {
    if (editingRep && editingRep.name.trim()) {
      let instagramHandle = editingRep.instagram?.trim() || '';
      if (instagramHandle && !instagramHandle.startsWith('@')) {
        instagramHandle = '@' + instagramHandle;
      }
      updateRep(editingRep.id, {
        name: editingRep.name.trim(),
        phoneNumber: editingRep.phoneNumber?.trim() || undefined,
        instagram: instagramHandle || undefined,
        notes: editingRep.notes?.trim() || undefined,
      });
      setEditingRep(null);
      setEditModalVisible(false);
    }
  };

  const handleDeleteRep = (repId: string, repName: string) => {
    Alert.alert(
      'Delete Rep',
      `Are you sure you want to delete ${repName}? This will also delete all their notes and todos.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRep(repId);
          },
        },
      ]
    );
  };

  const openEditModal = (rep: any) => {
    setEditingRep({
      id: rep.id,
      name: rep.name,
      phoneNumber: rep.phoneNumber,
      instagram: rep.instagram,
      notes: rep.notes,
    });
    setEditModalVisible(true);
  };

  const pickContact = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Contact picker is not available on web');
      return;
    }

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant contacts permission to select a phone number'
        );
        return;
      }

      const contact = await Contacts.presentContactPickerAsync();
      
      if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        const phoneNumber = contact.phoneNumbers[0].number;
        setNewRepPhone(phoneNumber || '');
      }
    } catch (error) {
      console.error('Error picking contact:', error);
      Alert.alert('Error', 'Failed to pick contact');
    }
  };

  const openInstagram = async () => {
    const webUrl = 'https://www.instagram.com/';
    
    try {
      await Linking.openURL(webUrl);
    } catch (error) {
      console.error('Error opening Instagram:', error);
      Alert.alert('Error', 'Failed to open Instagram');
    }
  };

  const getTimeSinceContact = (rep: any) => {
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
      if (diffHours === 0) return 'Just now';
      return `${diffHours}h ago`;
    }
    return `${diffDays}d ago`;
  };

  const getUrgencyColor = (rep: any) => {
    if (!rep.last_contacted_at) return '#EF4444';

    const now = new Date();
    const lastContact = new Date(rep.last_contacted_at);
    const diffMs = now.getTime() - lastContact.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 48) return '#EF4444';
    if (diffHours > 24) return '#F59E0B';
    return '#10B981';
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

  const handleMarkContacted = async (repId: string, currentContactedToday: boolean) => {
    try {
      await toggleContactedStatus(repId, currentContactedToday);
    } catch (err) {
      console.error('Failed to update contact status:', err);
    }
  };

  if (!leader) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Leader Not Found',
          }}
        />
        <View style={styles.emptyState}>
          <AlertCircle size={64} color="#D1D5DB" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Leader Not Found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `${leader.name}'s Team`,
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <ChevronLeft size={24} color="#0EA5E9" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setModalVisible(true)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addButtonPressed,
              ]}
            >
              <Plus size={24} color="#0EA5E9" />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
              <Text style={styles.performanceValue}>{Math.round(calculateDailyContactPercentage)}%</Text>
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
              <Text style={styles.performanceValue}>{Math.round(calculateWeeklyContactPercentage)}%</Text>
              <Text style={styles.performanceDescription}>Reps touched in 7 days</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <TrendingUp size={24} color="#0EA5E9" />
            </View>
            <Text style={styles.statValue}>{leaderReps.length}</Text>
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

        {leaderReps.length === 0 && (
          <View style={styles.emptyState}>
            <UserCircle size={64} color="#D1D5DB" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Team Members Yet</Text>
            <Text style={styles.emptyDescription}>
              Add sales reps for {leader.name}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Add Sales Rep</Text>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter rep name"
                placeholderTextColor="#9CA3AF"
                value={newRepName}
                onChangeText={setNewRepName}
              />
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.phoneInputContainer}>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  placeholder="Enter phone number (optional)"
                  placeholderTextColor="#9CA3AF"
                  value={newRepPhone}
                  onChangeText={setNewRepPhone}
                  keyboardType="phone-pad"
                />
                {Platform.OS !== 'web' && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactPickerButton,
                      pressed && styles.contactPickerButtonPressed,
                    ]}
                    onPress={pickContact}
                  >
                    <BookUser size={20} color="#0EA5E9" />
                  </Pressable>
                )}
              </View>
              <Text style={styles.fieldLabel}>Instagram Handle</Text>
              <View style={styles.phoneInputContainer}>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  placeholder="@username (optional)"
                  placeholderTextColor="#9CA3AF"
                  value={newRepInstagram}
                  onChangeText={(text) => {
                    if (text && !text.startsWith('@')) {
                      setNewRepInstagram('@' + text);
                    } else {
                      setNewRepInstagram(text);
                    }
                  }}
                  autoCapitalize="none"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.instagramButton,
                    pressed && styles.contactPickerButtonPressed,
                  ]}
                  onPress={openInstagram}
                >
                  <Instagram size={20} color="#E4405F" />
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add initial notes (optional)"
                placeholderTextColor="#9CA3AF"
                value={newRepNotes}
                onChangeText={setNewRepNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setModalVisible(false);
                    setNewRepName('');
                    setNewRepPhone('');
                    setNewRepInstagram('');
                    setNewRepNotes('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.addButtonModal,
                    pressed && styles.buttonPressed,
                    !newRepName.trim() && styles.buttonDisabled,
                  ]}
                  onPress={handleAddRep}
                  disabled={!newRepName.trim()}
                >
                  <Text style={styles.addButtonText}>Add Rep</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setEditModalVisible(false)}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Edit Sales Rep</Text>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter rep name"
                placeholderTextColor="#9CA3AF"
                value={editingRep?.name ?? ''}
                onChangeText={(text) => setEditingRep(prev => prev ? { ...prev, name: text } : null)}
              />
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter phone number (optional)"
                placeholderTextColor="#9CA3AF"
                value={editingRep?.phoneNumber ?? ''}
                onChangeText={(text) => setEditingRep(prev => prev ? { ...prev, phoneNumber: text } : null)}
                keyboardType="phone-pad"
              />
              <Text style={styles.fieldLabel}>Instagram Handle</Text>
              <TextInput
                style={styles.input}
                placeholder="@username (optional)"
                placeholderTextColor="#9CA3AF"
                value={editingRep?.instagram ?? ''}
                onChangeText={(text) => {
                  const formatted = text && !text.startsWith('@') ? '@' + text : text;
                  setEditingRep(prev => prev ? { ...prev, instagram: formatted } : null);
                }}
                autoCapitalize="none"
              />
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add notes (optional)"
                placeholderTextColor="#9CA3AF"
                value={editingRep?.notes ?? ''}
                onChangeText={(text) => setEditingRep(prev => prev ? { ...prev, notes: text } : null)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => {
                    setEditModalVisible(false);
                    setEditingRep(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    styles.addButtonModal,
                    pressed && styles.buttonPressed,
                    !editingRep?.name.trim() && styles.buttonDisabled,
                  ]}
                  onPress={handleEditRep}
                  disabled={!editingRep?.name.trim()}
                >
                  <Text style={styles.addButtonText}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    padding: 4,
    marginLeft: 4,
  },
  backButtonPressed: {
    opacity: 0.6,
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
  todoIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  addButton: {
    padding: 4,
    marginRight: 8,
  },
  addButtonPressed: {
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  urgentBadge: {
    marginLeft: 8,
  },
  notesPreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  noNotes: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
  editButton: {
    backgroundColor: '#F9FAFB',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
  deleteButton: {
    backgroundColor: '#F9FAFB',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#EF4444',
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
  textArea: {
    minHeight: 80,
    marginBottom: 20,
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
  addButtonModal: {
    backgroundColor: '#0EA5E9',
  },
  addButtonText: {
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
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  contactPickerButton: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactPickerButtonPressed: {
    opacity: 0.7,
  },
  instagramButton: {
    backgroundColor: '#FFE8ED',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
