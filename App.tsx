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
  const [mode, setMode] = useState<'payments' | 'courts'>('payments');
  const [numCourts, setNumCourts] = useState(4);
  
  interface QueueGroup {
    id: string;
    type: 'Competitive' | 'Casual';
    players: (string | null)[];
    originalQueueIndex?: number;
  }
  
  const [queueGroups, setQueueGroups] = useState<QueueGroup[]>([
    { id: '1', type: 'Competitive', players: [null, null, null, null] }
  ]);
  
  const [playingGames, setPlayingGames] = useState<QueueGroup[]>([]);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
  const [selectedGameToUndo, setSelectedGameToUndo] = useState<string | null>(null);

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
      setParticipants(data);
      await AsyncStorage.setItem('participants', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving participants:', error);
    }
  };

  const deleteParticipant = async (id: string) => {
    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting participant:', error);
      Alert.alert('Error', 'Failed to delete from database');
    }
  };

  const deleteAllParticipants = async () => {
    try {
      // Get all participant IDs
      const ids = participants.map(p => p.id);
      
      if (ids.length === 0) {
        console.log('No participants to delete');
        return;
      }
      
      console.log('Deleting participants:', ids);
      
      const { error, data } = await supabase
        .from('participants')
        .delete()
        .in('id', ids);
      
      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
      
      console.log('Delete successful:', data);
    } catch (error) {
      console.error('Error deleting all participants:', error);
      Alert.alert('Error', `Failed to clear database: ${error.message || 'Unknown error'}`);
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
      })
      .map(line => {
        // Remove leading numbers and dots/dashes (e.g., "1. John" -> "John", "12 - Jane" -> "Jane")
        return line.replace(/^\d+[\.\-\s)]+/, '').trim();
      });

    // Remove duplicates
    return [...new Set(lines)];
  };

  const cleanName = (name: string): string => {
    // Remove leading numbers and punctuation from any name
    return name.replace(/^\d+[\.\-\s)]+/, '').trim();
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

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const addParsedParticipants = () => {
    const newParticipants = parsedNames.map(name => ({
      id: generateUUID(),
      name: name,
      paymentMethod: null as null,
    }));
    
    const updated = [...participants, ...newParticipants];
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
        id: generateUUID(),
        name: nameInput.trim(),
        paymentMethod: null,
      };
      const updated = [...participants, newParticipant];
      saveParticipants(updated);
      setNameInput('');
      setModalVisible(false);
    }
  };

  const handlePayment = (participantId: string, method: 'Cash' | 'E-Transfer') => {
    updatePaymentMethod(participantId, method);
  };

  const handleNoteClick = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    setSelectedParticipant(participant || null);
    // Load existing note if available
    const existingNote = participant?.note || '';
    setNoteInput(existingNote);
    setNoteModalVisible(true);
  };

  const updatePaymentMethod = (participantId: string, method: 'Cash' | 'E-Transfer', note?: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, paymentMethod: method, note: note !== undefined ? note : p.note }
        : p
    );
    saveParticipants(updated);
  };

  const saveNote = () => {
    if (selectedParticipant) {
      const updated = participants.map(p =>
        p.id === selectedParticipant.id
          ? { ...p, note: noteInput.trim() }
          : p
      );
      saveParticipants(updated);
      setNoteModalVisible(false);
      setSelectedParticipant(null);
      setNoteInput('');
    }
  };

  const clearPayment = (participantId: string) => {
    const updated = participants.map(p =>
      p.id === participantId
        ? { ...p, paymentMethod: null }
        : p
    );
    saveParticipants(updated);
  };

  const clearAllParticipants = () => {
    setClearAllModalVisible(true);
  };

  const confirmClearAll = () => {
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

  const getSelectedPlayers = (): string[] => {
    const selected: string[] = [];
    queueGroups.forEach(group => {
      group.players.forEach(playerId => {
        if (playerId) selected.push(playerId);
      });
    });
    playingGames.forEach(game => {
      game.players.forEach(playerId => {
        if (playerId) selected.push(playerId);
      });
    });
    return selected;
  };

  const getAvailablePlayers = (currentGroupId: string, currentSlot: number) => {
    const selectedPlayers = getSelectedPlayers();
    const currentGroup = queueGroups.find(g => g.id === currentGroupId);
    const currentSelection = currentGroup?.players[currentSlot];
    
    return participants
      .filter(p => 
        !selectedPlayers.includes(p.id) || p.id === currentSelection
      )
      .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)));
  };

  const updateQueueGroup = (groupId: string, field: 'type' | 'player', value: any, playerIndex?: number) => {
    setQueueGroups(groups => {
      const updatedGroups = groups.map(group => {
        if (group.id === groupId) {
          if (field === 'type') {
            return { ...group, type: value };
          } else if (field === 'player' && playerIndex !== undefined) {
            const newPlayers = [...group.players];
            newPlayers[playerIndex] = value;
            return { ...group, players: newPlayers };
          }
        }
        return group;
      });

      // Check if we need to add a new empty group
      if (field === 'player' && value) {
        const hasEmptyGroup = updatedGroups.some(group => 
          group.players.every(p => p === null)
        );
        
        if (!hasEmptyGroup) {
          const newId = String(Date.now());
          updatedGroups.push({ id: newId, type: 'Competitive', players: [null, null, null, null] });
        }
      }

      return updatedGroups;
    });
  };

  const addQueueGroup = () => {
    const newId = String(Date.now());
    setQueueGroups([...queueGroups, { id: newId, type: 'Competitive', players: [null, null, null, null] }]);
  };

  const removeQueueGroup = (groupId: string) => {
    setQueueGroups(groups => groups.filter(g => g.id !== groupId));
  };

  const startGame = (groupId: string) => {
    // Check if courts are available
    if (playingGames.length >= numCourts) {
      return; // Can't start game, all courts are full
    }
    
    const groupIndex = queueGroups.findIndex(g => g.id === groupId);
    const group = queueGroups[groupIndex];
    if (group) {
      // Save the original queue index before moving
      const groupWithIndex = { ...group, originalQueueIndex: groupIndex };
      // Move group to playing games
      setPlayingGames([...playingGames, groupWithIndex]);
      // Remove from queue
      setQueueGroups(groups => groups.filter(g => g.id !== groupId));
    }
  };

  const completeGame = (gameId: string) => {
    // Remove from playing games (players automatically return to available pool)
    setPlayingGames(games => games.filter(g => g.id !== gameId));
  };

  const undoStartGame = () => {
    if (!selectedGameToUndo) return;
    
    const game = playingGames.find(g => g.id === selectedGameToUndo);
    if (game) {
      // Remove from playing games
      setPlayingGames(games => games.filter(g => g.id !== selectedGameToUndo));
      
      // Insert back into queue at original position
      const insertIndex = game.originalQueueIndex !== undefined ? game.originalQueueIndex : queueGroups.length;
      const newQueue = [...queueGroups];
      const { originalQueueIndex, ...gameWithoutIndex } = game;
      newQueue.splice(insertIndex, 0, gameWithoutIndex);
      setQueueGroups(newQueue);
    }
    
    setUndoModalVisible(false);
    setSelectedGameToUndo(null);
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
            onPress={() => item.paymentMethod === 'E-Transfer' 
              ? clearPayment(item.id) 
              : handlePayment(item.id, 'E-Transfer')
            }
          >
            <Text style={[
              styles.buttonText,
              item.paymentMethod === 'E-Transfer' && styles.selectedButtonText,
            ]}>
              {item.paymentMethod === 'E-Transfer' ? '✓' : 'e'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentButton,
              styles.noteButton,
              item.note && styles.noteButtonActive,
            ]}
            onPress={() => handleNoteClick(item.id)}
          >
            <Text style={[
              styles.buttonText,
              item.note && styles.noteButtonTextActive,
            ]}>
              📝
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={[styles.container, mode === 'courts' && styles.containerWide]}>
        <StatusBar style="auto" />
        
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Badminton Drop-in</Text>
            {mode === 'courts' && (
              <View style={styles.courtsControlInline}>
                <TouchableOpacity
                  style={styles.courtControlButton}
                  onPress={() => setNumCourts(Math.max(1, numCourts - 1))}
                >
                  <Text style={styles.courtControlButtonText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.courtsInput}
                  value={String(numCourts)}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!isNaN(num) && num > 0) {
                      setNumCourts(num);
                    } else if (text === '') {
                      setNumCourts(1);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TouchableOpacity
                  style={styles.courtControlButton}
                  onPress={() => setNumCourts(numCourts + 1)}
                >
                  <Text style={styles.courtControlButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.modeToggle}
              onPress={() => setMode(mode === 'payments' ? 'courts' : 'payments')}
            >
              <Text style={styles.modeToggleText}>
                {mode === 'payments' ? 'Courts' : 'Payments'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {mode === 'payments' 
              ? `${participants.filter(p => p.paymentMethod).length} / ${participants.length} paid`
              : 'Court Assignment'
            }
          </Text>
        </View>

        {mode === 'payments' ? (
          <>
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
          </>
        ) : (
          <View style={styles.courtsLayout}>
            <View style={styles.courtsLeft}>
              <View style={[styles.courtBox, styles.playingContainer]}>
                <Text style={styles.courtBoxTitle}>Playing</Text>
                <ScrollView style={styles.queueContainer}>
                  <View style={styles.queueGroupsWrapper}>
                    {playingGames.map((game) => (
                      <View key={game.id} style={styles.playingGameCard}>
                        <View style={[
                          styles.gameTypeIndicator,
                          game.type === 'Competitive' ? styles.competitiveIndicator : styles.casualIndicator
                        ]}>
                          <Text style={styles.gameTypeText}>{game.type}</Text>
                        </View>
                        {game.players.map((playerId, index) => {
                          const player = participants.find(p => p.id === playerId);
                          return player ? (
                            <Text key={index} style={styles.playingPlayerName}>
                              {cleanName(player.name)}
                            </Text>
                          ) : null;
                        })}
                        <View style={styles.gameButtonsRow}>
                          <TouchableOpacity
                            style={styles.undoButton}
                            onPress={() => {
                              setSelectedGameToUndo(game.id);
                              setUndoModalVisible(true);
                            }}
                          >
                            <Text style={styles.undoButtonText}>↶</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.completeGameButton}
                            onPress={() => completeGame(game.id)}
                          >
                            <Text style={styles.completeGameButtonText}>Complete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {playingGames.length === 0 && (
                      <Text style={styles.emptyPlayerText}>No active games</Text>
                    )}
                  </View>
                </ScrollView>
              </View>
              <View style={[styles.courtBox, styles.inQueueContainer]}>
                <Text style={styles.courtBoxTitle}>In queue</Text>
                <ScrollView style={styles.queueContainer}>
                  <View style={styles.queueGroupsWrapper}>
                    {queueGroups.map((group) => (
                      <View key={group.id} style={styles.queueGroup}>
                      <View style={styles.queueGroupHeader}>
                        <View style={styles.typeToggle}>
                          <TouchableOpacity
                            style={[
                              styles.typeButtonBase,
                              group.type === 'Competitive' ? styles.typeButtonCompetitive : styles.typeButtonInactive
                            ]}
                            onPress={() => updateQueueGroup(group.id, 'type', 'Competitive')}
                          >
                            <Text style={[styles.typeButtonText, group.type === 'Competitive' && styles.typeButtonTextActive]}>
                              Competitive
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.typeButtonBase,
                              group.type === 'Casual' ? styles.typeButtonCasual : styles.typeButtonInactive
                            ]}
                            onPress={() => updateQueueGroup(group.id, 'type', 'Casual')}
                          >
                            <Text style={[styles.typeButtonText, group.type === 'Casual' && styles.typeButtonTextActive]}>
                              Casual
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {group.players.map((playerId, index) => (
                        <View key={index} style={styles.playerSelectRow}>
                          <Text style={styles.playerLabel}>P{index + 1}:</Text>
                          <select
                            value={playerId || ''}
                            onChange={(e) => updateQueueGroup(group.id, 'player', e.target.value || null, index)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: 12,
                              borderRadius: 5,
                              border: '1px solid #d1d5db',
                              fontSize: 16,
                              backgroundColor: '#fff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <option value=""></option>
                            {getAvailablePlayers(group.id, index).map((p) => (
                              <option key={p.id} value={p.id}>
                                {cleanName(p.name)}
                              </option>
                            ))}
                          </select>
                        </View>
                      ))}
                      <TouchableOpacity 
                        style={[
                          styles.startGameButton,
                          (!group.players.every(p => p !== null) || playingGames.length >= numCourts) && styles.startGameButtonDisabled
                        ]}
                        onPress={() => startGame(group.id)}
                        disabled={!group.players.every(p => p !== null) || playingGames.length >= numCourts}
                      >
                        <Text style={styles.startGameButtonText}>
                          {playingGames.length >= numCourts ? 'Courts Full' : 'Start Game'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  </View>
                </ScrollView>
              </View>
            </View>
            <View style={styles.courtsRight}>
              <View style={styles.playerBox}>
                <Text style={styles.playerBoxTitle}>Available Players</Text>
                <ScrollView style={styles.playerList}>
                  {participants
                    .filter(p => !getSelectedPlayers().includes(p.id))
                    .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)))
                    .map((participant) => (
                      <View key={participant.id} style={styles.playerItem}>
                        <Text style={styles.playerName}>{cleanName(participant.name)}</Text>
                      </View>
                    ))
                  }
                  {participants.filter(p => !getSelectedPlayers().includes(p.id)).length === 0 && (
                    <Text style={styles.emptyPlayerText}>
                      {participants.length === 0 ? 'No players yet' : 'All players assigned'}
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </View>
        )}

      {/* Add Participant Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.compactModalContent}>
                <Text style={styles.modalTitle}>Add Participant</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Enter name"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  autoComplete="off"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={addParticipant}
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
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Note Modal */}
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
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setNoteModalVisible(false);
              setNoteInput('');
              setSelectedParticipant(null);
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.compactModalContent}>
                <Text style={styles.modalTitle}>Note</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedParticipant?.name}
                </Text>
                
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note (optional)"
                  value={noteInput}
                  onChangeText={setNoteInput}
                  multiline={false}
                  autoFocus
                  returnKeyType="done"
                  blurOnSubmit={true}
                  autoComplete="off"
                  autoCorrect={false}
                  onSubmitEditing={saveNote}
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
            </TouchableOpacity>
          </TouchableOpacity>
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
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              setTextInputModalVisible(false);
              setTextListInput('');
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
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
                  autoComplete="off"
                  autoCorrect={false}
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
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Undo Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={undoModalVisible}
        onRequestClose={() => setUndoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Undo Start Game?</Text>
            <Text style={styles.confirmModalText}>
              This will move the game back to the queue at its original position.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setUndoModalVisible(false);
                  setSelectedGameToUndo(null);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={undoStartGame}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>Undo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  containerWide: {
    maxWidth: '100%',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  courtsControlInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -75 }],
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modeToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modeToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#dbeafe',
  },
  courtsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  courtsControlLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  courtsControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  courtControlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  courtControlButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  courtsInput: {
    backgroundColor: '#fff',
    width: 50,
    height: 36,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
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
  noteButton: {
    backgroundColor: '#fff',
    borderColor: '#9ca3af',
  },
  noteButtonActive: {
    backgroundColor: '#fbbf24',
    borderColor: '#f59e0b',
  },
  noteButtonTextActive: {
    color: '#fff',
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
  modalOverlayTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  compactModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    width: 320,
    maxHeight: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  courtsLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  courtsLeft: {
    flex: 7,
    gap: 12,
  },
  courtsRight: {
    flex: 1,
  },
  courtBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playingContainer: {
    flex: 0.8,
  },
  inQueueContainer: {
    flex: 1.2,
  },
  courtBoxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
  },
  playerBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerBoxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
  },
  playerList: {
    flex: 1,
  },
  playerItem: {
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  playerName: {
    fontSize: 15,
    color: '#1f2937',
  },
  emptyPlayerText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  queueContainer: {
    flex: 1,
  },
  queueGroupsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  queueGroup: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#9ca3af',
    width: 230,
  },
  queueGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  typeButtonBase: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonCompetitive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  typeButtonCasual: {
    backgroundColor: '#eab308',
    borderColor: '#eab308',
  },
  typeButtonInactive: {
    backgroundColor: '#d1d5db',
    borderColor: '#9ca3af',
  },
  typeButtonSelected: {
    opacity: 1,
  },
  typeButtonText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  playerSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  playerLabel: {
    fontSize: 15,
    color: '#4b5563',
    fontWeight: '500',
    width: 32,
  },
  startGameButton: {
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  startGameButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.5,
  },
  startGameButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  addQueueButton: {
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  addQueueButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  playingGameCard: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#9ca3af',
    width: 230,
  },
  gameTypeIndicator: {
    padding: 6,
    borderRadius: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  competitiveIndicator: {
    backgroundColor: '#ef4444',
  },
  casualIndicator: {
    backgroundColor: '#eab308',
  },
  gameTypeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  playingPlayerName: {
    fontSize: 15,
    color: '#1f2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  gameButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  completeGameButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  completeGameButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  undoButton: {
    backgroundColor: '#6b7280',
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  undoButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
