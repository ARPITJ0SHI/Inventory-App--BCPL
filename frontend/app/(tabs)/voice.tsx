import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Dimensions, ScrollView, Platform, Modal, FlatList, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router'; // To handle focus/blur
import api, { API_URL } from '../../src/services/api';

const { width, height } = Dimensions.get('window');

export default function VoiceScreen() {
    const insets = useSafeAreaInsets();
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Press Start to begin');
    const [userTranscription, setUserTranscription] = useState<string | null>(null);
    const [agentResponse, setAgentResponse] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<any>(null);
    const [selectionOptions, setSelectionOptions] = useState<string[] | null>(null); // For ambiguous items
    const [conversation, setConversation] = useState<{ role: string, content: string }[]>([]);

    // Session State (V3)
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.5)).current;
    const orbScale = useRef(new Animated.Value(1)).current;

    // Breathing Animation
    useEffect(() => {
        if (isListening) {
            Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
                        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
                    ]),
                    Animated.sequence([
                        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                        Animated.timing(glowAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true })
                    ])
                ])
            ).start();
        } else {
            // Reset animations
            Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
            Animated.timing(glowAnim, { toValue: 0.5, duration: 500, useNativeDriver: true }).start();
        }
    }, [isListening]);

    // Orb float animation (Always active slightly)
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(orbScale, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
                Animated.timing(orbScale, { toValue: 1, duration: 3000, useNativeDriver: true })
            ])
        ).start();
    }, []);

    // Cleanup on Blur (Tab switch)
    useFocusEffect(
        React.useCallback(() => {
            return () => {
                // Stop recording if active
                if (recording) stopRecording();
                Speech.stop();
                // Stop any playing audio
                if (soundRef.current) {
                    soundRef.current.stopAsync().catch(() => { });
                    soundRef.current.unloadAsync().catch(() => { });
                    soundRef.current = null;
                }
            };
        }, [recording])
    );

    // VAD & Auto-Loop Refs
    const SILENCE_THRESHOLD_DB = -45; // Below this is silence
    const SILENCE_DURATION_MS = 1500; // Stop after 1.5s silence
    const MIN_RECORDING_MS = 1000;    // Don't stop before 1s

    const lastSpeakingTime = useRef<number>(Date.now());
    const isVoiceDetected = useRef<boolean>(false);
    const silenceTimer = useRef<NodeJS.Timeout | null>(null);
    const isRecordingRef = useRef<boolean>(false);

    // ========== SESSION MANAGEMENT ==========
    const startSession = async () => {
        try {
            setStatusMessage('Starting session...');
            const response = await api.post('/agent/session/start');
            const { sessionId: newSessionId, text, audio } = response.data;

            setSessionId(newSessionId);
            setIsSessionActive(true);
            setAgentResponse(text);
            setStatusMessage('Hold mic to speak');

            // Play greeting
            if (audio) {
                await playAudio(audio);
            } else if (text) {
                Speech.speak(text, { language: 'en-IN' });
            }
        } catch (error) {
            console.error('Start session error:', error);
            setAgentResponse('Failed to start session. Check connection.');
            setStatusMessage('Press Start to begin');
        }
    };

    const endSession = async () => {
        try {
            if (sessionId) {
                await api.post('/agent/session/end', { sessionId });
            }
        } catch (error) {
            console.error('End session error:', error);
        } finally {
            // Stop any ongoing playback
            Speech.stop();
            if (soundRef.current) {
                await soundRef.current.stopAsync().catch(() => { });
                await soundRef.current.unloadAsync().catch(() => { });
                soundRef.current = null;
            }
            // Reset state
            setSessionId(null);
            setIsSessionActive(false);
            setAgentResponse(null);
            setUserTranscription(null);
            setPendingAction(null);
            setStatusMessage('Press Start to begin');
        }
    };

    // Helper to play base64 audio
    const playAudio = async (base64Audio: string) => {
        try {
            Speech.stop();
            if (soundRef.current) {
                await soundRef.current.stopAsync().catch(() => { });
                await soundRef.current.unloadAsync().catch(() => { });
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/mp3;base64,${base64Audio}` },
                { shouldPlay: true }
            );
            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status: any) => {
                if (status.didJustFinish) {
                    sound.unloadAsync();
                    soundRef.current = null;
                }
            });
        } catch (error) {
            console.error('Audio playback error:', error);
        }
    };

    // Hold-to-talk handlers
    const isSendingRef = useRef<boolean>(false); // Guard against duplicate sends

    const handlePressIn = async () => {
        if (!isSessionActive || isProcessing || isSendingRef.current) return;
        await startRecording();
    };

    const handlePressOut = async () => {
        if (!isSessionActive || !isListening || isSendingRef.current) return;
        isSendingRef.current = true; // Prevent duplicate sends
        try {
            await stopRecording();
        } finally {
            // Reset after a delay to prevent rapid re-triggers
            setTimeout(() => {
                isSendingRef.current = false;
            }, 500);
        }
    };

    const startRecording = async () => {
        // Guard against double recording starts
        if (isRecordingRef.current || recordingRef.current) {
            console.log('Already recording, ignoring start request');
            return;
        }

        try {
            isRecordingRef.current = true; // Set guard immediately

            // Cancel any pending silence timer
            if (silenceTimer.current) clearTimeout(silenceTimer.current);

            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                setAgentResponse('Microphone permission needed.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRec);
            recordingRef.current = newRec; // Update ref
            setIsListening(true);
            setStatusMessage('Listening...');
            setAgentResponse(null);
            setUserTranscription(null);
            setPendingAction(null);

            // Reset VAD state
            lastSpeakingTime.current = Date.now();
            isVoiceDetected.current = false;

        } catch (err) {
            console.error('Failed to start recording', err);
            setAgentResponse('Failed to start recording.');
            isRecordingRef.current = false; // Reset guard on error
        }
    };

    const stopRecording = async () => {
        // STRICT CHECK: Only use ref. State is too slow update.
        const currentRec = recordingRef.current;
        if (!currentRec) {
            console.log('[VOICE] No active recording ref to stop'); // Debug log
            return;
        }

        // Prevent double stopping logic/loops
        setRecording(null); // Clear state immediately
        recordingRef.current = null;
        isRecordingRef.current = false; // Reset double-start guard
        setIsListening(false);
        setIsProcessing(true);
        setStatusMessage('Sending to AI...');

        if (silenceTimer.current) clearTimeout(silenceTimer.current);

        try {
            // Try to get URI first, just in case unload fails
            const uri = currentRec.getURI();
            const status = await currentRec.getStatusAsync();
            const duration = status.durationMillis;

            try {
                await currentRec.stopAndUnloadAsync();
            } catch (unloadError) {
                console.log('Unload warning (ignoring):', unloadError);
            }

            if (uri && duration > 500) { // Ignore short taps (< 500ms)
                console.log(`[VOICE] Sending audio (${duration}ms):`, uri); // DEBUG LOG
                await sendAudioToBackend(uri);
            } else {
                console.log(`[VOICE] Audio too short (${duration}ms) or missing URI`); // DEBUG LOG
                setAgentResponse(duration < 500 ? 'Hold button to speak...' : 'No audio recorded.');
                setIsProcessing(false);
            }
        } catch (error) {
            console.error('Stop recording error', error);
            setAgentResponse('Error stopping recording.');
            setIsProcessing(false);
        }
    };

    const sendAudioToBackend = async (uri: string) => {
        try {
            // Fix for Android file path
            const platformUri = (Platform.OS === 'android' && !uri.startsWith('file://')) ? `file://${uri}` : uri;

            const token = await SecureStore.getItemAsync('token');
            const headers: Record<string, string> = {
                'Accept': 'application/json',
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            console.log(`[VOICE] Uploading to ${API_URL}/agent/chat`);

            const response = await FileSystem.uploadAsync(`${API_URL}/agent/chat`, platformUri, {
                fieldName: 'audio',
                httpMethod: 'POST',
                uploadType: 1, // Force MULTIPART (0 = Binary, 1 = Multipart)
                headers: headers,
                parameters: sessionId ? { sessionId } : undefined,
            });

            console.log('[VOICE] Upload Status:', response.status);

            if (response.status >= 200 && response.status < 300) {
                const data = JSON.parse(response.body);
                handleAgentResponse(data);
            } else {
                throw new Error(`Server returned ${response.status}: ${response.body}`);
            }

        } catch (error) {
            console.error('[VOICE] Upload Error:', error);
            setAgentResponse("Sorry, check your connection.");
            Speech.speak("Sorry, connection failed.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAgentResponse = async (data: any) => {
        // Show what user said
        if (data.transcription) {
            setUserTranscription(data.transcription);
        }

        setStatusMessage(isSessionActive ? 'Hold mic to speak' : 'Press Start to begin');
        setAgentResponse(data.text);

        // Play audio response
        if (data.audio) {
            await playAudio(data.audio);
        } else if (data.text) {
            Speech.speak(data.text, { language: 'en-IN' });
        }

        // Handle confirmation action
        if (data.action && data.action.type === 'CONFIRM') {
            setPendingAction(data.action);
        }
    };

    const confirmAction = async () => {
        if (!pendingAction) return;

        setIsProcessing(true);
        try {
            const response = await api.post('/agent/confirm', {
                tool: pendingAction.tool,
                args: pendingAction.args
            });

            if (response.data.success) {
                const msg = response.data.message;

                // Handle Ambiguity
                if (msg && msg.startsWith('AMBIGUOUS:')) {
                    try {
                        const options = JSON.parse(msg.replace('AMBIGUOUS:', ''));
                        setSelectionOptions(options);
                        return; // Stop here, wait for selection
                    } catch (e) {
                        console.error("Failed to parse ambiguous options", e);
                        Alert.alert("Error", "Multiple items found, but selection failed.");
                    }
                } else {
                    // Success
                    setAgentResponse(msg || "Done!");
                    Speech.speak("Done!", { language: 'en-IN' });
                    setPendingAction(null);
                    setStatusMessage('Hold mic to speak');

                    // Add to conversation
                    setConversation(prev => [...prev, { role: 'assistant', content: msg || "Action confirmed." }]);
                }
            } else {
                Alert.alert("Error", response.data.error || "Failed");
            }
        } catch (error) {
            console.error("Confirmation failed", error);
            setAgentResponse("Failed to execute.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelection = (selectedItem: string) => {
        setSelectionOptions(null);
        if (pendingAction) {
            // Update the pending action with the selected name
            const oldName = pendingAction.args.itemName;
            setPendingAction({
                ...pendingAction,
                args: { ...pendingAction.args, itemName: selectedItem },
                message: pendingAction.message.replace(oldName, selectedItem) // Update display message
            });
            // User can now click "Confirm" again with the correct name
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e1b4b', '#000000']}
                style={styles.background}
            />

            <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}>

                {/* Header / Title */}
                <View style={styles.header}>
                    <Text style={styles.headerText}>Inventory Agent</Text>
                </View>

                {/* Orb Container (Center) */}
                <View style={styles.orbContainer}>
                    <Animated.View style={{
                        transform: [
                            { scale: isListening ? pulseAnim : orbScale }
                        ],
                        opacity: isListening ? glowAnim : 0.8
                    }}>
                        <LinearGradient
                            colors={isListening ? ['#00ffff', '#0000ff', '#8a2be2'] : ['#4f46e5', '#818cf8', '#c084fc']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.orb}
                        />
                    </Animated.View>

                    {/* Status Icon Overlay */}
                    <View style={styles.orbIconOverlay}>
                        {isProcessing ? (
                            <ActivityIndicator size="large" color="#fff" />
                        ) : (
                            <Ionicons name={isListening ? "mic" : "mic-outline"} size={50} color="rgba(255,255,255,0.7)" />
                        )}
                    </View>
                </View>

                {/* Status Text */}
                <Text style={styles.statusText}>{statusMessage}</Text>

                {/* Conversation Area */}
                <ScrollView contentContainerStyle={styles.responseContainer} showsVerticalScrollIndicator={false}>
                    {/* User's transcription (what they said) */}
                    {userTranscription && (
                        <View style={styles.userBubble}>
                            <Text style={styles.userBubbleText}>{userTranscription}</Text>
                        </View>
                    )}

                    {/* Agent's response */}
                    {agentResponse && (
                        <Text style={styles.responseText}>{agentResponse}</Text>
                    )}

                    {/* Thinking indicator */}
                    {isProcessing && (
                        <View style={styles.thinkingContainer}>
                            <ActivityIndicator size="small" color="#818cf8" />
                            <Text style={styles.thinkingText}>Agent is thinking...</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Confirmation Modal */}
                <Modal
                    visible={!!pendingAction}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setPendingAction(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.confirmCard}>
                            <View style={styles.confirmHeader}>
                                <Ionicons name="warning" size={24} color="#f59e0b" />
                                <Text style={styles.confirmTitle}>Action Required</Text>
                            </View>
                            <Text style={styles.confirmMessage}>{pendingAction?.message}</Text>
                            <View style={styles.confirmButtons}>
                                <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setPendingAction(null)}>
                                    <Text style={styles.btnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={confirmAction}>
                                    <LinearGradient colors={['#4f46e5', '#6366f1']} style={styles.btnGradient}>
                                        <Text style={styles.btnTextWhite}>Confirm</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Selection Modal (For Ambiguity) */}
                <Modal
                    visible={!!selectionOptions}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setSelectionOptions(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.confirmCard}>
                            <Text style={styles.confirmTitle}>Select Correct Item</Text>
                            <Text style={styles.confirmMessage}>Multiple items matched your request:</Text>
                            <FlatList
                                data={selectionOptions}
                                keyExtractor={(item) => item}
                                style={{ maxHeight: 200, width: '100%', marginTop: 10 }}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.optionItem}
                                        onPress={() => handleSelection(item)}
                                    >
                                        <Text style={styles.optionText}>{item}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                            <TouchableOpacity style={[styles.btn, styles.btnCancel, { marginTop: 10 }]} onPress={() => setSelectionOptions(null)}>
                                <Text style={styles.btnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Session Controls */}
                <View style={styles.controls}>
                    {!isSessionActive ? (
                        // Start Button
                        <TouchableOpacity
                            style={styles.startButton}
                            onPress={startSession}
                            disabled={isProcessing}
                        >
                            <LinearGradient
                                colors={['#10b981', '#059669']}
                                style={styles.sessionButtonGradient}
                            >
                                <Ionicons name="play" size={28} color="white" />
                                <Text style={styles.sessionButtonText}>Start</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        // Active Session: Hold-to-talk + Stop
                        <View style={styles.sessionActiveControls}>
                            {/* Hold to Talk Button */}
                            <TouchableOpacity
                                style={styles.micButton}
                                activeOpacity={0.7}
                                onPressIn={handlePressIn}
                                onPressOut={handlePressOut}
                                disabled={isProcessing}
                            >
                                <LinearGradient
                                    colors={isListening ? ['#ef4444', '#dc2626'] : isProcessing ? ['#6b7280', '#4b5563'] : ['#4f46e5', '#6366f1']}
                                    style={styles.micButtonGradient}
                                >
                                    <Ionicons name={isListening ? "mic" : isProcessing ? "hourglass" : "mic-outline"} size={32} color="white" />
                                </LinearGradient>
                            </TouchableOpacity>
                            <Text style={styles.holdHint}>{isListening ? 'Release to send' : 'Hold to speak'}</Text>

                            {/* Stop Session Button */}
                            <TouchableOpacity
                                style={styles.stopButton}
                                onPress={endSession}
                            >
                                <Ionicons name="stop-circle" size={40} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    background: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    safeArea: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    header: {
        marginTop: 20,
        marginBottom: 40,
    },
    headerText: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    orbContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    orb: {
        width: 180,
        height: 180,
        borderRadius: 90,
        shadowColor: "#4f46e5",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
        elevation: 20,
    },
    orbIconOverlay: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 16,
        marginBottom: 20,
        fontWeight: '500',
    },
    responseContainer: {
        flexGrow: 1,
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
    },
    responseText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 34,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    controls: {
        marginTop: 20,
        marginBottom: 20,
    },
    micButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
    },
    micButtonGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    confirmCard: {
        width: '85%',
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    confirmHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 10,
    },
    confirmTitle: {
        color: '#f59e0b',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
    },
    confirmMessage: {
        color: 'white',
        fontSize: 18,
        marginBottom: 20,
        lineHeight: 26,
    },
    confirmButtons: {
        flexDirection: 'row',
        gap: 15,
    },
    optionItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    optionText: {
        color: '#fff',
        fontSize: 16,
    },
    btn: {
        flex: 1,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    btnConfirm: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    btnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    btnTextWhite: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    btnCancel: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    userBubble: {
        backgroundColor: 'rgba(79, 70, 229, 0.3)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 16,
        alignSelf: 'flex-end',
        maxWidth: '80%',
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.3)',
    },
    userBubbleText: {
        color: '#c7d2fe',
        fontSize: 16,
        fontStyle: 'italic',
    },
    thinkingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    thinkingText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    // Session V3 Styles
    startButton: {
        width: 160,
        height: 60,
        borderRadius: 30,
        elevation: 10,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    sessionButtonGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    sessionButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    sessionActiveControls: {
        alignItems: 'center',
        gap: 10,
    },
    holdHint: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        marginTop: 8,
    },
    stopButton: {
        marginTop: 20,
        padding: 10,
    },
});
