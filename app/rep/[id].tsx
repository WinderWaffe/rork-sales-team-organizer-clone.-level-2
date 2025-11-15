import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Edit2, Flag, MessageSquare, Trash2, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
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

import { useRepById, useSalesTeam } from '@/contexts/sales-team-context';
import { Todo } from '@/types/sales-rep';

export default function RepProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rep = useRepById(id);
  const { updateRep, updateLastContact, deleteRep, addTodo, updateTodo, deleteTodo, toggleTodoStatus } = useSalesTeam();
  const router = useRouter();

  const [notes, setNotes] = useState(rep?.notes || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState(rep?.phoneNumber || '');
  const [editInstagram, setEditInstagram] = useState(rep?.instagram || '');
  
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDescription, setTodoDescription] = useState('');
  const [todoDueDate, setTodoDueDate] = useState('');
  const [titleError, setTitleError] = useState('');
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [undoDeleteTimer, setUndoDeleteTimer] = useState<NodeJS.Timeout | null>(null);
  const [deletedTodo, setDeletedTodo] = useState<{ todo: Todo; repId: string } | null>(null);

  const sortedTodos = useMemo(() => {
    if (!rep?.todos) return [];

    const openTodos = rep.todos.filter((t) => t.status === 'open');
    const doneTodos = rep.todos.filter((t) => t.status === 'done');

    openTodos.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    doneTodos.sort((a, b) => {
      const aCompleted = a.completedAt || a.updatedAt;
      const bCompleted = b.completedAt || b.updatedAt;
      return new Date(bCompleted).getTime() - new Date(aCompleted).getTime();
    });

    return [...openTodos, ...doneTodos];
  }, [rep?.todos]);

  if (!rep) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Sales rep not found</Text>
      </View>
    );
  }

  const handleSaveNotes = () => {
    updateRep(id, { notes });
    setHasChanges(false);
  };

  const handleSaveContact = () => {
    updateRep(id, {
      phoneNumber: editPhone.trim() || undefined,
      instagram: editInstagram.trim() || undefined,
    });
    setIsEditingContact(false);
  };

  const handleCancelEdit = () => {
    setEditPhone(rep?.phoneNumber || '');
    setEditInstagram(rep?.instagram || '');
    setIsEditingContact(false);
  };

  const handleOpenSMS = () => {
    if (rep?.phoneNumber) {
      const url = `sms:${rep.phoneNumber}`;
      Linking.openURL(url).catch(err => {
        Alert.alert('Error', 'Unable to open messaging app');
      });
    }
  };

  const handleOpenInstagram = () => {
    if (rep?.instagram) {
      const username = rep.instagram.replace('@', '');
      const webUrl = `https://www.instagram.com/${username}`;
      
      Linking.openURL(webUrl).catch(err => {
        Alert.alert('Error', 'Unable to open Instagram');
      });
    }
  };

  const handleMarkContacted = () => {
    updateLastContact(id);
    Alert.alert('Success', 'Contact date updated to now');
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Sales Rep',
      `Are you sure you want to delete ${rep.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRep(id);
            router.back();
          },
        },
      ]
    );
  };

  const getTimeSinceContact = () => {
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
      return `${diffHours} hours ago`;
    }
    return `${diffDays} days ago`;
  };

  const getUrgencyColor = () => {
    if (!rep.last_contacted_at) return '#EF4444';

    const now = new Date();
    const lastContact = new Date(rep.last_contacted_at);
    const diffMs = now.getTime() - lastContact.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 48) return '#EF4444';
    if (diffHours > 24) return '#F59E0B';
    return '#10B981';
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: rep.name,
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Trash2 size={20} color="#EF4444" />
            </Pressable>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {rep.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{rep.name}</Text>
        </View>

        <View style={styles.contactInfoCard}>
          <View style={styles.contactInfoHeader}>
            <Text style={styles.contactInfoTitle}>Contact Information</Text>
            {!isEditingContact && (
              <Pressable
                onPress={() => setIsEditingContact(true)}
                style={({ pressed }) => [
                  styles.editIconButton,
                  pressed && styles.editIconButtonPressed,
                ]}
              >
                <Edit2 size={18} color="#0EA5E9" />
              </Pressable>
            )}
          </View>
          
          {isEditingContact ? (
            <View style={styles.editForm}>
              <Text style={styles.editLabel}>Phone Number</Text>
              <TextInput
                style={styles.editInput}
                placeholder="Enter phone number"
                placeholderTextColor="#9CA3AF"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
              />
              <Text style={styles.editLabel}>Instagram Handle</Text>
              <TextInput
                style={styles.editInput}
                placeholder="@username"
                placeholderTextColor="#9CA3AF"
                value={editInstagram}
                onChangeText={setEditInstagram}
                autoCapitalize="none"
              />
              <View style={styles.editButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    styles.cancelEditButton,
                    pressed && styles.editButtonPressed,
                  ]}
                  onPress={handleCancelEdit}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.editButton,
                    styles.saveEditButton,
                    pressed && styles.editButtonPressed,
                  ]}
                  onPress={handleSaveContact}
                >
                  <Text style={styles.saveEditText}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.contactDetails}>
              {rep.phoneNumber ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.contactItem,
                    pressed && styles.contactItemPressed,
                  ]}
                  onPress={handleOpenSMS}
                >
                  <MessageSquare size={20} color="#0EA5E9" />
                  <Text style={styles.contactValue}>{rep.phoneNumber}</Text>
                </Pressable>
              ) : (
                <View style={styles.contactItem}>
                  <Text style={styles.noContactText}>No phone number</Text>
                </View>
              )}
              {rep.instagram ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.contactItem,
                    pressed && styles.contactItemPressed,
                  ]}
                  onPress={handleOpenInstagram}
                >
                  <Text style={styles.contactLabel}>Instagram:</Text>
                  <Text style={styles.contactValue}>{rep.instagram}</Text>
                </Pressable>
              ) : (
                <View style={styles.contactItem}>
                  <Text style={styles.noContactText}>No Instagram handle</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Last Contact</Text>
            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: getUrgencyColor() },
                ]}
              />
              <Text style={styles.statusText}>{getTimeSinceContact()}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.contactButton,
              pressed && styles.contactButtonPressed,
            ]}
            onPress={handleMarkContacted}
          >
            <Check size={20} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Mark as Contacted</Text>
          </Pressable>
        </View>

        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Meeting Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={(text) => {
              setNotes(text);
              setHasChanges(text !== rep.notes);
            }}
            placeholder="Add notes from your last meeting..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
          {hasChanges && (
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
              ]}
              onPress={handleSaveNotes}
            >
              <Text style={styles.saveButtonText}>Save Notes</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.todosSection}>
          <Text style={styles.todosLabel}>To Dos</Text>
          
          {rep.todos && rep.todos.length > 0 && (
            <View style={styles.todosList}>
              {sortedTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  repId={id}
                  isExpanded={expandedTodos.has(todo.id)}
                  onToggleExpand={() => {
                    const newExpanded = new Set(expandedTodos);
                    if (newExpanded.has(todo.id)) {
                      newExpanded.delete(todo.id);
                    } else {
                      newExpanded.add(todo.id);
                    }
                    setExpandedTodos(newExpanded);
                  }}
                  onToggleStatus={() => toggleTodoStatus(id, todo.id)}
                  onEdit={() => {
                    setEditingTodo(todo);
                    setTodoTitle(todo.title);
                    setTodoDescription(todo.description || '');
                    setTodoDueDate(todo.dueDate || '');
                    setShowAddTodoModal(true);
                  }}
                  onDelete={() => {
                    if (undoDeleteTimer) {
                      clearTimeout(undoDeleteTimer);
                    }
                    setDeletedTodo({ todo, repId: id });
                    deleteTodo(id, todo.id);
                    const timer = setTimeout(() => {
                      setDeletedTodo(null);
                    }, 4000);
                    setUndoDeleteTimer(timer);
                  }}
                />
              ))}
            </View>
          )}
          
          <Pressable
            style={({ pressed }) => [
              styles.addTodoButton,
              pressed && styles.addTodoButtonPressed,
            ]}
            onPress={() => setShowAddTodoModal(true)}
          >
            <Flag size={20} color="#0EA5E9" fill="#0EA5E9" />
            <Text style={styles.addTodoButtonText}>Add To Do</Text>
          </Pressable>
        </View>

        <View style={styles.metaSection}>
          <Text style={styles.metaLabel}>Member Since</Text>
          <Text style={styles.metaValue}>
            {new Date(rep.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      </ScrollView>

      {deletedTodo && (
        <View style={styles.undoToast}>
          <Text style={styles.undoToastText}>To Do deleted</Text>
          <Pressable
            onPress={() => {
              if (undoDeleteTimer) {
                clearTimeout(undoDeleteTimer);
              }
              addTodo(deletedTodo.repId, {
                title: deletedTodo.todo.title,
                description: deletedTodo.todo.description,
                dueDate: deletedTodo.todo.dueDate,
              });
              setDeletedTodo(null);
              setUndoDeleteTimer(null);
            }}
          >
            <Text style={styles.undoToastButton}>Undo</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={showAddTodoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddTodoModal(false);
          setEditingTodo(null);
          setTodoTitle('');
          setTodoDescription('');
          setTodoDueDate('');
          setTitleError('');
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => {
                setShowAddTodoModal(false);
                setEditingTodo(null);
                setTodoTitle('');
                setTodoDescription('');
                setTodoDueDate('');
                setTitleError('');
              }}
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed && styles.modalCloseButtonPressed,
              ]}
            >
              <X size={24} color="#6B7280" />
            </Pressable>
            <Text style={styles.modalTitle}>{editingTodo ? 'Edit To Do' : 'New To Do'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>Title *</Text>
            <TextInput
              style={[styles.modalInput, titleError ? styles.modalInputError : null]}
              value={todoTitle}
              onChangeText={(text) => {
                setTodoTitle(text);
                if (titleError) setTitleError('');
              }}
              placeholder="Enter title"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            {titleError && <Text style={styles.errorMessage}>{titleError}</Text>}

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={todoDescription}
              onChangeText={setTodoDescription}
              placeholder="Enter description (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Due Date</Text>
            <TextInput
              style={styles.modalInput}
              value={todoDueDate}
              onChangeText={setTodoDueDate}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor="#9CA3AF"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalCancelButton,
                pressed && styles.modalButtonPressed,
              ]}
              onPress={() => {
                setShowAddTodoModal(false);
                setEditingTodo(null);
                setTodoTitle('');
                setTodoDescription('');
                setTodoDueDate('');
                setTitleError('');
              }}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalSaveButton,
                pressed && styles.modalButtonPressed,
              ]}
              onPress={() => {
                if (!todoTitle.trim()) {
                  setTitleError('Title is required');
                  return;
                }

                if (editingTodo) {
                  updateTodo(id, editingTodo.id, {
                    title: todoTitle.trim(),
                    description: todoDescription.trim() || undefined,
                    dueDate: todoDueDate.trim() || undefined,
                  });
                } else {
                  addTodo(id, {
                    title: todoTitle.trim(),
                    description: todoDescription.trim() || undefined,
                    dueDate: todoDueDate.trim() || undefined,
                  });
                }

                setShowAddTodoModal(false);
                setEditingTodo(null);
                setTodoTitle('');
                setTodoDescription('');
                setTodoDueDate('');
                setTitleError('');
              }}
            >
              <Text style={styles.modalSaveButtonText}>Save</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );

  function TodoItem({
    todo,
    repId,
    isExpanded,
    onToggleExpand,
    onToggleStatus,
    onEdit,
    onDelete,
  }: {
    todo: Todo;
    repId: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onToggleStatus: () => void;
    onEdit: () => void;
    onDelete: () => void;
  }) {
    const hasDescription = todo.description && todo.description.trim().length > 0;

    return (
      <View style={styles.todoItem}>
        <View style={styles.todoHeader}>
          <Pressable
            onPress={onToggleStatus}
            style={styles.todoCheckbox}
            accessibilityLabel={todo.status === 'done' ? 'Mark as open' : 'Mark as done'}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: todo.status === 'done' }}
          >
            {todo.status === 'done' ? (
              <View style={styles.checkboxChecked}>
                <Check size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : (
              <View style={styles.checkboxUnchecked} />
            )}
          </Pressable>

          <Pressable
            style={styles.todoContent}
            onPress={hasDescription ? onToggleExpand : undefined}
          >
            <Text
              style={[
                styles.todoTitle,
                todo.status === 'done' && styles.todoTitleDone,
              ]}
            >
              {todo.title}
            </Text>
            {todo.dueDate && (
              <Text style={styles.todoDueDate}>
                Due: {new Date(todo.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            )}
            {hasDescription && isExpanded && (
              <Text style={styles.todoDescription}>{todo.description}</Text>
            )}
          </Pressable>

          <View style={styles.todoActions}>
            {hasDescription && (
              <Pressable onPress={onToggleExpand} style={styles.todoActionButton}>
                {isExpanded ? (
                  <ChevronUp size={18} color="#6B7280" />
                ) : (
                  <ChevronDown size={18} color="#6B7280" />
                )}
              </Pressable>
            )}
            <Pressable
              onPress={onEdit}
              style={styles.todoActionButton}
              accessibilityLabel="Edit todo"
            >
              <Edit2 size={16} color="#0EA5E9" />
            </Pressable>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Delete To Do',
                  'Are you sure you want to delete this to do?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDelete },
                  ]
                );
              }}
              style={styles.todoActionButton}
              accessibilityLabel="Delete todo"
            >
              <Trash2 size={16} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
  name: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
  },
  contactInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  contactInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactInfoTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#111827',
  },
  editIconButton: {
    padding: 4,
  },
  editIconButtonPressed: {
    opacity: 0.6,
  },
  contactDetails: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  contactItemPressed: {
    opacity: 0.7,
  },
  contactLabel: {
    fontSize: 15,
    color: '#6B7280',
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#0EA5E9',
  },
  noContactText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  editForm: {
    gap: 12,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  editInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelEditButton: {
    backgroundColor: '#F3F4F6',
  },
  saveEditButton: {
    backgroundColor: '#0EA5E9',
  },
  cancelEditText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
  },
  saveEditText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  editButtonPressed: {
    opacity: 0.8,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#111827',
  },
  contactButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactButtonPressed: {
    opacity: 0.8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  metaSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 15,
    color: '#111827',
  },
  deleteButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 32,
  },
  todosSection: {
    marginBottom: 16,
  },
  todosLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  todosList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  todoItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 12,
  },
  todoCheckbox: {
    padding: 4,
    marginTop: 2,
  },
  checkboxUnchecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  checkboxChecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  todoTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  todoDueDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  todoDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 20,
  },
  todoActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  todoActionButton: {
    padding: 6,
  },
  addTodoButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  addTodoButtonPressed: {
    opacity: 0.8,
  },
  addTodoButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseButtonPressed: {
    opacity: 0.6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalInputError: {
    borderColor: '#EF4444',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorMessage: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalSaveButton: {
    backgroundColor: '#0EA5E9',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#374151',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  modalButtonPressed: {
    opacity: 0.8,
  },
  undoToast: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  undoToastText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  undoToastButton: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0EA5E9',
  },
});
