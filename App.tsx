import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

interface Participant {
  id: string;
  name: string;
  paymentMethod: 'Cash' | 'E-Transfer' | null;
  note?: string;
}

export default function App() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [parsedNames, setParsedNames] = useState<string[]>([]);
  const [clearAllModalVisible, setClearAllModalVisible] = useState(false);
  const [textInputModalVisible, setTextInputModalVisible] = useState(false);
  const [textListInput, setTextListInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    try {
      const stored = await AsyncStorage.getItem('participants');
      if (stored) {
        setParticipants(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const saveParticipants = async (data: Participant[]) => {
    try {
      await AsyncStorage.setItem('participants', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving participants:', error);
    }
  };

  const processOCR = async (imageUri: string) => {
    try {
      setIsProcessing(true);

      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Use OCR.space API (free tier)
      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        headers: {
          apikey: 'K87899142388957', // Free public API key
        },
      });

      const result = await response.json();

      if (result.ParsedResults && result.ParsedResults[0]) {
        const text = result.ParsedResults[0].ParsedText;
        const names = parseNames(text);
        
        if (names.length > 0) {
          setParsedNames(names);
          setReviewModalVisible(true);
        } else {
          Alert.alert('No names found', 'Could not extract any names from the image. Try manual entry.');
        }
      } else {
        Alert.alert('OCR Failed', 'Could not process image. Try again or use manual entry.');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const parseNames = (text: string): string[] => {
    // Split by newlines and clean up
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => {
        // Filter out common non-name patterns
        const lowerLine = line.toLowerCase();
        return !lowerLine.includes('http') &&
               !lowerLine.includes('www') &&
               !lowerLine.includes('@') &&
               line.length < 50 && // Skip very long lines
               /[a-zA-Z]/.test(line); // Must contain at least one letter
      });

    // Remove duplicates
    return [...new Set(lines)];
  };

  const pickImage = async () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Use native file input for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          // Convert to base64 for web
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
              await processOCRWeb(base64);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      
      input.click();
    } else {
      // Native mobile flow
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to select images');
        return;
      }

      const result = await ImagePicker.launchImagePickerAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processOCR(result.assets[0].uri);
      }
    }
  };

  const processOCRWeb = async (base64DataUrl: string) => {
    try {
      setIsProcessing(true);

      // Extract base64 without the data URL prefix
      const base64 = base64DataUrl.split(',')[1];

      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        headers: {
          apikey: 'K87899142388957',
        },
      });

      const result = await response.json();

      if (result.ParsedResults && result.ParsedResults[0]) {
        const text = result.ParsedResults[0].ParsedText;
        const names = parseNames(text);
        
        if (names.length > 0) {
          setParsedNames(names);
          setReviewModalVisible(true);
        } else {
          Alert.alert('No names found', 'Could not extract any names from the image. Try manual entry.');
        }
      } else {
        Alert.alert('OCR Failed', 'Could not process image. Try again or use manual entry.');
      }
    } catch (error) {
      console.error('OCR Error:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const addParsedParticipants = () => {
    const newParticipants = parsedNames.map(name => ({
      id: `${Date.now()}-${Math.random()}`,
      name: name,
      paymentMethod: null as null,
    }));
    
    const updated = [...participants, ...newParticipants];
    setParticipants(updated);
    saveParticipants(updated);
    setReviewModalVisible(false);
    setParsedNames([]);
  };

  const removeParsedName = (index: number) => {
    setParsedNames(prev => prev.filter((_, i) => i !== index));
  };

  const addParticipant = () => {
    if (nameInput.trim()) {
      const newParticipant: Participant = {
        id: Date.now().toString(),
        name: nameInput.trim(),
        paymentMethod: null,
      };
      const updated = [...participants, newParticipant];
      setParticipants(updated);
      saveParticipants(updated);
      setNameInput('');
      setModalVisible(false);
    }
  };

  const handlePayment = (participantId: string, method: 'Cash' | 'E-Transfer') => {
    const participant = participants.find(p => p.id === participantId);
    
    if (method === 'E-Transfer') {
      setSelectedParticipant(participant || null);
      // Load existing note if available
      const existingNote = participant?.note || '';
      setNoteInput(existingNote);
      setNoteModalVisible(true);
    } else {
      // For Cash, clear any note
      updatePaymentMethod(participantId, method, '');
    }
  };

  const updatePaymentMethod = (participantId: string, method: 'Cash' | 'E-Transfer', note?: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, paymentMethod: method, note: note !== undefined ? note : p.note }
        : p
    );
    setParticipants(updated);
    saveParticipants(updated);
  };

  const saveNote = () => {
    if (selectedParticipant) {
      // Save the note (can be empty string to clear it)
      updatePaymentMethod(selectedParticipant.id, 'E-Transfer', noteInput.trim());
      setNoteModalVisible(false);
      setSelectedParticipant(null);
      setNoteInput('');
    }
  };

  const clearPayment = (participantId: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, paymentMethod: null, note: '' }
        : p
    );
    setParticipants(updated);
    saveParticipants(updated);
  };

  const clearAllParticipants = () => {
    setClearAllModalVisible(true);
  };

  const confirmClearAll = () => {
    setParticipants([]);
    saveParticipants([]);
    setClearAllModalVisible(false);
  };

  const processTextList = () => {
    const names = parseNames(textListInput);
    if (names.length > 0) {
      setParsedNames(names);
      setTextInputModalVisible(false);
      setTextListInput('');
      setReviewModalVisible(true);
    } else {
      Alert.alert('No names found', 'Please enter at least one name (one per line).');
    }
  };

  const getFilteredParticipants = () => {
    if (filter === 'paid') {
      return participants.filter(p => p.paymentMethod !== null);
    } else if (filter === 'unpaid') {
      return participants.filter(p => p.paymentMethod === null);
    }
    return participants;
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <View style={styles.participantCard}>
      <View style={styles.participantRow}>
        <View style={styles.nameContainer}>
          <Text style={styles.participantName}>{item.name}</Text>
          {item.note && (
            <Text style={styles.noteText}>{item.note}</Text>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.paymentButton,
              styles.cashButton,
              item.paymentMethod === 'Cash' && styles.selectedCash,
            ]}
            onPress={() => item.paymentMethod === 'Cash' 
              ? clearPayment(item.id) 
              : handlePayment(item.id, 'Cash')
            }
          >
            <Text style={[
              styles.buttonText,
              item.paymentMethod === 'Cash' && styles.selectedButtonText,
            ]}>
              {item.paymentMethod === 'Cash' ? '✓' : '$'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentButton,
              styles.etransferButton,
              item.paymentMethod === 'E-Transfer' && styles.selectedEtransfer,
            ]}
            onPress={() => handlePayment(item.id, 'E-Transfer')}
          >
            <Text style={[
              styles.buttonText,
              item.paymentMethod === 'E-Transfer' && styles.selectedButtonText,
            ]}>
              {item.paymentMethod === 'E-Transfer' ? '✓' : 'e'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        
        <View style={styles.header}>
          <Text style={styles.title}>Badminton Drop-in Payments</Text>
          <Text style={styles.subtitle}>
            {participants.filter(p => p.paymentMethod).length} / {participants.length} paid
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.compactButton, styles.uploadButton]}
            onPress={pickImage}
            disabled={isProcessing}
          >
            <Text style={styles.compactButtonText}>
              {isProcessing ? '⏳' : '📸'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.compactButton, styles.textButton]}
            onPress={() => setTextInputModalVisible(true)}
          >
            <Text style={styles.compactButtonText}>📋</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.compactButton, styles.addButton]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.compactButtonText}>+</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.compactButton, styles.clearButton]}
            onPress={clearAllParticipants}
          >
            <Text style={styles.compactButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
              Show All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filter === 'paid' && styles.filterButtonActive]}
            onPress={() => setFilter('paid')}
          >
            <Text style={[styles.filterButtonText, filter === 'paid' && styles.filterButtonTextActive]}>
              Paid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, filter === 'unpaid' && styles.filterButtonActive]}
            onPress={() => setFilter('unpaid')}
          >
            <Text style={[styles.filterButtonText, filter === 'unpaid' && styles.filterButtonTextActive]}>
              Not Paid
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={getFilteredParticipants()}
          renderItem={renderParticipant}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {filter === 'paid' ? 'No paid participants' : 
                 filter === 'unpaid' ? 'No unpaid participants' : 
                 'No participants yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' ? 'Tap "+" to add participants' : 'Try a different filter'}
              </Text>
            </View>
          }
        />

      {/* Add Participant Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Participant</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter name"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setNameInput('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addParticipant}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* E-Transfer Note Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={noteModalVisible}
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.noteModalContent}>
              <Text style={styles.noteModalTitle}>E-Transfer Note</Text>
              <Text style={styles.noteModalSubtitle}>
                {selectedParticipant?.name}
              </Text>
              
              <TextInput
                style={styles.noteInput}
                placeholder="E-Transfer sender name (optional)"
                value={noteInput}
                onChangeText={setNoteInput}
                multiline={false}
                autoFocus
                returnKeyType="done"
                blurOnSubmit={true}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setNoteModalVisible(false);
                    setNoteInput('');
                    setSelectedParticipant(null);
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveNote}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Review Parsed Names Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reviewModalVisible}
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.reviewModal]}>
            <Text style={styles.modalTitle}>Review Parsed Names</Text>
            <Text style={styles.modalSubtitle}>
              Found {parsedNames.length} names. Tap to remove any incorrect entries.
            </Text>
            
            <ScrollView 
              style={styles.namesList}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {parsedNames.map((name, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.parsedNameItem}
                  onPress={() => removeParsedName(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.parsedNameText}>{name}</Text>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setReviewModalVisible(false);
                  setParsedNames([]);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addParsedParticipants}
                disabled={parsedNames.length === 0}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Add {parsedNames.length} Participants
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear All Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={clearAllModalVisible}
        onRequestClose={() => setClearAllModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Clear All Participants?</Text>
            <Text style={styles.confirmModalText}>
              This will remove all participants and their payment records. This action cannot be undone.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setClearAllModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmClearAll}
              >
                <Text style={[styles.modalButtonText, styles.deleteButtonText]}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Text List Input Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={textInputModalVisible}
        onRequestClose={() => setTextInputModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.textInputModalContent}>
              <Text style={styles.modalTitle}>Paste Name List</Text>
              <Text style={styles.modalSubtitle}>
                Enter or paste names (one per line)
              </Text>
              
              <TextInput
                style={styles.textListInput}
                placeholder="Enter names (one per line)..."
                value={textListInput}
                onChangeText={setTextListInput}
                multiline
                autoFocus
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setTextInputModalVisible(false);
                    setTextListInput('');
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={processTextList}
                >
                  <Text style={[styles.modalButtonText, styles.saveButtonText]}>Process</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    maxWidth: 768,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#dbeafe',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 8,
    gap: 8,
    justifyContent: 'space-between',
  },
  compactButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  compactButtonText: {
    fontSize: 20,
  },
  headerButton: {
    flex: 1,
    minWidth: 100,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: '#8b5cf6',
  },
  textButton: {
    backgroundColor: '#3b82f6',
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  clearButton: {
    backgroundColor: '#ef4444',
  },
  filterButtons: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  headerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  participantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flex: 1,
    marginRight: 10,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  paymentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  cashButton: {
    backgroundColor: '#fff',
    borderColor: '#10b981',
  },
  etransferButton: {
    backgroundColor: '#fff',
    borderColor: '#2563eb',
  },
  selectedCash: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  selectedEtransfer: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#6b7280',
  },
  selectedButtonText: {
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  noteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  noteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#1f2937',
    textAlign: 'center',
  },
  noteModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  modalButtonText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#374151',
  },
  saveButtonText: {
    color: '#fff',
  },
  reviewModal: {
    maxHeight: '80%',
    height: 'auto',
  },
  namesList: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 400,
    minHeight: 100,
    marginBottom: 20,
  },
  parsedNameItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  parsedNameText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  removeText: {
    fontSize: 20,
    color: '#ef4444',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  confirmModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
  confirmModalText: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#fff',
  },
  textInputModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  textListInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 20,
    minHeight: 200,
    maxHeight: 300,
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb',
  },
});
