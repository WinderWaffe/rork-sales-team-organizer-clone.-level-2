import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { AlertCircle, ArrowLeft, BookUser, ChevronLeft, Instagram, Plus, Settings, UserCircle } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
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

export default function LeaderViewScreen() {
  const { leaderId } = useLocalSearchParams<{ leaderId: string }>();
  const { getUserById } = useUser();
  const { reps, addRep, updateRep, deleteRep } = useSalesTeam();
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

      {leaderReps.length === 0 ? (
        <View style={styles.emptyState}>
          <UserCircle size={64} color="#D1D5DB" strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Team Members Yet</Text>
          <Text style={styles.emptyDescription}>
            Add sales reps for {leader.name}
          </Text>
        </View>
      ) : (
        <FlatList
          data={leaderReps}
          contentContainerStyle={styles.listContent}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [
                  styles.cardContent,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => router.push(`/rep/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <View style={styles.timeContainer}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getUrgencyColor(item),
                          },
                        ]}
                      />
                      <Text style={styles.timeText}>
                        Last contact {getTimeSinceContact(item)}
                      </Text>
                    </View>
                  </View>
                  {item.last_contacted_at && new Date().getTime() -
                    new Date(item.last_contacted_at).getTime() >
                    48 * 60 * 60 * 1000 && (
                    <View style={styles.urgentBadge}>
                      <AlertCircle size={16} color="#EF4444" />
                    </View>
                  )}
                </View>
                {item.notes ? (
                  <Text style={styles.notesPreview} numberOfLines={2}>
                    {item.notes}
                  </Text>
                ) : (
                  <Text style={styles.noNotes}>No meeting notes</Text>
                )}
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.editButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() => openEditModal(item)}
                >
                  <Settings size={16} color="#0EA5E9" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.deleteButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={() => handleDeleteRep(item.id, item.name)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

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
