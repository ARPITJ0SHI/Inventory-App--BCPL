import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Dimensions, ScrollView, Platform, Modal, FlatList, Alert } from 'react-native';
import { voiceStyles as styles } from '../../src/styles/voiceStyles';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const { width, height } = Dimensions.get('window');

// Derive WebSocket URL from API_URL
const getWebSocketUrl = () => {
    const httpUrl = API_URL.replace('/api', '');
    const wsUrl = httpUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${wsUrl}/ws/agent`;
};

export default function VoiceScreen() {
    const insets = useSafeAreaInsets();
    const { token } = useAuth();
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Press Start to begin');
    const [userTranscription, setUserTranscription] = useState<string | null>(null);
    const [agentResponse, setAgentResponse] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<any>(null);
    const [selectionOptions, setSelectionOptions] = useState<string[] | null>(null);

    // WebSocket State
    const wsRef = useRef<WebSocket | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Audio streaming state
    const audioChunksRef = useRef<Uint8Array[]>([]);
    const isPlayingRef = useRef(false);
    const lastResponseTextRef = useRef<string | null>(null);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.5)).current;
    const orbScale = useRef(new Animated.Value(1)).current;

    // Recording guard
    const isRecordingRef = useRef<boolean>(false);
    const isSendingRef = useRef<boolean>(false);

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
            Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
            Animated.timing(glowAnim, { toValue: 0.5, duration: 500, useNativeDriver: true }).start();
        }
    }, [isListening]);

    // Orb float animation
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(orbScale, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
                Animated.timing(orbScale, { toValue: 1, duration: 3000, useNativeDriver: true })
            ])
        ).start();
    }, []);

    // Cleanup on blur
    useFocusEffect(
        useCallback(() => {
            return () => {
                if (recordingRef.current) stopRecording();
                Speech.stop();
                if (soundRef.current) {
                    soundRef.current.stopAsync().catch(() => { });
                    soundRef.current.unloadAsync().catch(() => { });
                    soundRef.current = null;
                }
                // Don't close WebSocket on blur, keep session alive
            };
        }, [])
    );

    // ========== WEBSOCKET MANAGEMENT ==========
    const connectWebSocket = useCallback(() => {
        // Guard against double connections
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
            console.log('[WS] Already connected or connecting, skipping');
            return;
        }

        const wsUrl = getWebSocketUrl();
        console.log('[WS] Connecting to:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[WS] Connected');
            setIsConnected(true);
            // Start session immediately
            ws.send(JSON.stringify({ type: 'start_session', token: token || '' }));
        };

        ws.onmessage = async (event) => {
            const data = event.data;

            // Check if it's a string (JSON message)
            if (typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    handleWebSocketMessage(parsed);
                } catch (e) {
                    console.log('[WS] Non-JSON string received:', data.substring(0, 50));
                }
            } else {
                // Binary audio chunk - could be Blob or ArrayBuffer
                console.log('[WS] Binary data received, type:', typeof data, 'constructor:', data?.constructor?.name);

                let chunk: Uint8Array;

                if (data instanceof Blob) {
                    const arrayBuffer = await data.arrayBuffer();
                    chunk = new Uint8Array(arrayBuffer);
                } else if (data instanceof ArrayBuffer) {
                    chunk = new Uint8Array(data);
                } else if (data && typeof data === 'object') {
                    // React Native might wrap it differently
                    console.log('[WS] Unknown binary format, data keys:', Object.keys(data));
                    return;
                } else {
                    console.log('[WS] Unknown data format');
                    return;
                }

                console.log('[WS] Audio chunk received, size:', chunk.length);
                audioChunksRef.current.push(chunk);

                // Start playback when we have first chunk
                if (!isPlayingRef.current && audioChunksRef.current.length === 1) {
                    playStreamedAudio();
                }
            }
        };

        ws.onerror = (error) => {
            console.error('[WS] Error:', error);
            setAgentResponse('Connection error. Try again.');
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected');
            setIsConnected(false);
            setIsSessionActive(false);
            wsRef.current = null;
        };
    }, []);

    const handleWebSocketMessage = (data: any) => {
        console.log('[WS] Message received:', data.type, data);
        switch (data.type) {
            case 'text':
                setAgentResponse(data.text);
                lastResponseTextRef.current = data.text; // Store for Speech fallback
                if (data.sessionId) {
                    console.log('[WS] Session started:', data.sessionId);
                    setIsSessionActive(true);
                    setStatusMessage('Hold mic to speak');
                }
                if (data.action && data.action.type === 'CONFIRM') {
                    setPendingAction(data.action);
                }
                break;

            case 'transcription':
                setUserTranscription(data.text);
                break;

            case 'status':
                if (data.status === 'processing') {
                    setStatusMessage('Processing...');
                } else if (data.status === 'transcribing') {
                    setStatusMessage('Transcribing...');
                } else if (data.status === 'thinking') {
                    setStatusMessage('Thinking...');
                } else if (data.status === 'executing') {
                    setStatusMessage('Executing...');
                }
                break;

            case 'audio_start':
                // Prepare for streaming audio
                console.log('[AUDIO] audio_start received');
                audioChunksRef.current = [];
                isPlayingRef.current = false;
                break;

            case 'audio_end':
                // Audio streaming complete
                console.log('[AUDIO] audio_end received, chunks:', audioChunksRef.current.length);
                setIsProcessing(false);
                setStatusMessage(isSessionActive ? 'Hold mic to speak' : 'Press Start to begin');

                // Fallback: if no audio chunks received, use text-to-speech
                if (audioChunksRef.current.length === 0 && lastResponseTextRef.current) {
                    console.log('[AUDIO] No chunks, using Speech fallback for:', lastResponseTextRef.current.substring(0, 30));
                    Speech.speak(lastResponseTextRef.current, { language: 'en-IN' });
                }
                break;

            case 'session_ended':
                setIsSessionActive(false);
                setAgentResponse(null);
                setUserTranscription(null);
                setPendingAction(null);
                setStatusMessage('Press Start to begin');
                break;

            case 'confirm_result':
                setIsProcessing(false);
                if (data.success) {
                    setAgentResponse(data.message || 'Done!');
                    setPendingAction(null);
                    setStatusMessage('Hold mic to speak');
                } else {
                    Alert.alert('Error', data.error || 'Failed');
                }
                break;

            case 'error':
                setIsProcessing(false);
                setAgentResponse(data.message || 'An error occurred');
                setStatusMessage(isSessionActive ? 'Hold mic to speak' : 'Press Start to begin');
                break;
        }
    };

    // Play streamed audio chunks
    const playStreamedAudio = async () => {
        if (audioChunksRef.current.length === 0) return;

        isPlayingRef.current = true;

        try {
            // Wait for more chunks to buffer (simple buffering strategy)
            await new Promise(resolve => setTimeout(resolve, 200));

            // Combine all chunks
            const totalLength = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
            const combinedBuffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunksRef.current) {
                combinedBuffer.set(chunk, offset);
                offset += chunk.length;
            }

            // Convert to base64 for expo-av
            const base64 = btoa(String.fromCharCode(...combinedBuffer));

            // Stop any existing audio
            Speech.stop();
            if (soundRef.current) {
                await soundRef.current.stopAsync().catch(() => { });
                await soundRef.current.unloadAsync().catch(() => { });
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/mp3;base64,${base64}` },
                { shouldPlay: true }
            );
            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    soundRef.current = null;
                    isPlayingRef.current = false;
                }
            });
        } catch (error) {
            console.error('[AUDIO] Playback error:', error);
            isPlayingRef.current = false;
            // Fallback to TTS if audio fails
            if (agentResponse) {
                Speech.speak(agentResponse, { language: 'en-IN' });
            }
        }
    };

    // ========== SESSION MANAGEMENT ==========
    const startSession = () => {
        setStatusMessage('Connecting...');
        connectWebSocket();
    };

    const endSession = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end_session' }));
            wsRef.current.close();
        }
        wsRef.current = null;
        setIsConnected(false);
        setIsSessionActive(false);
        setAgentResponse(null);
        setUserTranscription(null);
        setPendingAction(null);
        setStatusMessage('Press Start to begin');

        // Stop any audio
        Speech.stop();
        if (soundRef.current) {
            soundRef.current.stopAsync().catch(() => { });
            soundRef.current.unloadAsync().catch(() => { });
            soundRef.current = null;
        }
    };

    // ========== RECORDING ==========
    const handlePressIn = async () => {
        if (!isSessionActive || isProcessing || isSendingRef.current) return;
        await startRecording();
    };

    const handlePressOut = async () => {
        if (!isSessionActive || !isListening || isSendingRef.current) return;
        isSendingRef.current = true;
        try {
            await stopRecording();
        } finally {
            setTimeout(() => {
                isSendingRef.current = false;
            }, 500);
        }
    };

    const startRecording = async () => {
        if (isRecordingRef.current || recordingRef.current) {
            console.log('[VOICE] Already recording');
            return;
        }

        try {
            isRecordingRef.current = true;

            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                setAgentResponse('Microphone permission needed.');
                isRecordingRef.current = false;
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
            recordingRef.current = newRec;
            setIsListening(true);
            setStatusMessage('Listening...');
            setAgentResponse(null);
            setUserTranscription(null);
            setPendingAction(null);

        } catch (err) {
            console.error('[VOICE] Start recording error:', err);
            setAgentResponse('Failed to start recording.');
            isRecordingRef.current = false;
        }
    };

    const stopRecording = async () => {
        const currentRec = recordingRef.current;
        if (!currentRec) {
            console.log('[VOICE] No recording to stop');
            return;
        }

        setRecording(null);
        recordingRef.current = null;
        isRecordingRef.current = false;
        setIsListening(false);
        setIsProcessing(true);
        setStatusMessage('Sending...');

        try {
            const uri = currentRec.getURI();
            const status = await currentRec.getStatusAsync();
            const duration = status.durationMillis;

            try {
                await currentRec.stopAndUnloadAsync();
            } catch (e) {
                console.log('[VOICE] Unload warning:', e);
            }

            if (uri && duration > 500) {
                await sendAudioViaWebSocket(uri);
            } else {
                setAgentResponse(duration < 500 ? 'Hold button to speak...' : 'No audio recorded.');
                setIsProcessing(false);
                setStatusMessage('Hold mic to speak');
            }
        } catch (error) {
            console.error('[VOICE] Stop recording error:', error);
            setAgentResponse('Error stopping recording.');
            setIsProcessing(false);
        }
    };

    const sendAudioViaWebSocket = async (uri: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setAgentResponse('Not connected. Try again.');
            setIsProcessing(false);
            return;
        }

        try {
            // Read file as base64
            const base64Audio = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Convert base64 to binary
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Send binary audio
            wsRef.current.send(bytes.buffer);

            // Signal audio complete
            wsRef.current.send(JSON.stringify({ type: 'audio_complete' }));

        } catch (error) {
            console.error('[VOICE] Send audio error:', error);
            setAgentResponse('Failed to send audio.');
            setIsProcessing(false);
        }
    };

    // ========== CONFIRMATION ==========
    const confirmAction = () => {
        if (!pendingAction || !wsRef.current) return;

        setIsProcessing(true);
        wsRef.current.send(JSON.stringify({
            type: 'confirm',
            tool: pendingAction.tool,
            args: pendingAction.args
        }));
    };

    const handleSelection = (selectedItem: string) => {
        setSelectionOptions(null);
        if (pendingAction) {
            const oldName = pendingAction.args.itemName;
            setPendingAction({
                ...pendingAction,
                args: { ...pendingAction.args, itemName: selectedItem },
                message: pendingAction.message.replace(oldName, selectedItem)
            });
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#0f172a', '#1e1b4b', '#000000']}
                style={styles.background}
            />

            <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerText}>Inventory Agent</Text>
                    {isConnected && (
                        <View style={styles.connectedBadge}>
                            <View style={styles.connectedDot} />
                            <Text style={styles.connectedText}>Connected</Text>
                        </View>
                    )}
                </View>

                {/* Orb Container */}
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

                    <View style={styles.orbIconOverlay}>
                        {isProcessing ? (
                            <ActivityIndicator size="large" color="#fff" />
                        ) : (
                            <Ionicons name={isListening ? "mic" : "mic-outline"} size={50} color="rgba(255,255,255,0.7)" />
                        )}
                    </View>
                </View>

                {/* Status */}
                <Text style={styles.statusText}>{statusMessage}</Text>

                {/* Conversation */}
                <ScrollView contentContainerStyle={styles.responseContainer} showsVerticalScrollIndicator={false}>
                    {userTranscription && (
                        <View style={styles.userBubble}>
                            <Text style={styles.userBubbleText}>{userTranscription}</Text>
                        </View>
                    )}

                    {agentResponse && (
                        <Text style={styles.responseText}>{agentResponse}</Text>
                    )}

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

                {/* Selection Modal */}
                <Modal
                    visible={!!selectionOptions}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setSelectionOptions(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.confirmCard}>
                            <Text style={styles.confirmTitle}>Select Correct Item</Text>
                            <Text style={styles.confirmMessage}>Multiple items matched:</Text>
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

                {/* Controls */}
                <View style={styles.controls}>
                    {!isSessionActive ? (
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
                        <View style={styles.sessionActiveControls}>
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
