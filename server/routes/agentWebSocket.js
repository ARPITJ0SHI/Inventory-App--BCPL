/**
 * WebSocket Agent Handler
 * Handles real-time voice agent communication with streaming TTS
 */
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ElevenLabsClient } = require('elevenlabs');
const jwt = require('jsonwebtoken');

// Initialize AI Clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'placeholder' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'placeholder');
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

const elevenLabs = process.env.ELEVENLABS_API_KEY
    ? new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
    : null;

// Tool Definitions (same as agentRoutes.js)
const tools = [
    {
        functionDeclarations: [
            {
                name: "inventory_search",
                description: "Search for stock items. Useful for 'how much is left', 'find items'.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Product name to search for" },
                        location: { type: "STRING", description: "Filter by location", enum: ["shop", "factory"] }
                    },
                    required: ["query"]
                }
            },
            {
                name: "inventory_update",
                description: "Update stock quantity. ALWAYS requires confirmation.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        itemName: { type: "STRING" },
                        quantityChange: { type: "NUMBER" },
                        action: { type: "STRING", enum: ["add", "reduce", "set"] },
                        location: { type: "STRING", enum: ["shop", "factory"] }
                    },
                    required: ["itemName", "quantityChange", "action", "location"]
                }
            },
            {
                name: "orders_list",
                description: "List recent orders with details.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        limit: { type: "NUMBER", description: "Number of orders to return" },
                        status: { type: "STRING", enum: ["pending", "completed"] },
                        vendor: { type: "STRING", description: "Filter by vendor name" }
                    }
                }
            },
            {
                name: "inventory_count",
                description: "Get total number of unique stock items across all locations.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        location: { type: "STRING", description: "Optional location filter", enum: ["shop", "factory"] }
                    }
                }
            },
            {
                name: "inventory_list_sample",
                description: "Get names of a few stock items. Use when user asks what items are available.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        count: { type: "NUMBER", description: "Number of items to return (max 10)" },
                        location: { type: "STRING", description: "Optional location filter", enum: ["shop", "factory"] }
                    }
                }
            }
        ]
    }
];

// Session store
const sessions = new Map();

function createSession(userRole = 'viewer') {
    const sessionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, {
        history: [],
        createdAt: Date.now(),
        userRole: userRole
    });
    return sessionId;
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

function addToHistory(sessionId, role, content) {
    const session = sessions.get(sessionId);
    if (session) {
        session.history.push({ role, content });
        if (session.history.length > 20) {
            session.history = session.history.slice(-20);
        }
    }
}

/**
 * Initialize WebSocket server on existing HTTP server
 */
function initWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: '/ws/agent' });

    console.log('[WS] WebSocket server initialized on /ws/agent');

    wss.on('connection', (ws) => {
        console.log('[WS] Client connected');

        let sessionId = null;
        let audioChunks = [];

        ws.on('message', async (message) => {
            console.log('[WS] Raw message received, type:', typeof message, 'isBuffer:', Buffer.isBuffer(message), 'size:', message.length);
            try {
                // In Node.js ws, all messages come as Buffers
                // Try to parse as JSON first, if fails treat as binary audio
                const messageStr = message.toString();

                // Check if it looks like JSON (starts with {)
                if (messageStr.startsWith('{')) {
                    try {
                        const data = JSON.parse(messageStr);
                        console.log('[WS] JSON command:', data.type);
                        await handleCommand(ws, data, audioChunks, sessionId, (newSessionId) => {
                            sessionId = newSessionId;
                        });
                        audioChunks = []; // Reset after processing
                        return;
                    } catch (parseErr) {
                        // Not valid JSON, treat as binary
                        console.log('[WS] JSON parse failed, treating as binary');
                    }
                }

                // Binary audio chunk
                console.log('[WS] Binary audio chunk, size:', message.length);
                audioChunks.push(message);

            } catch (err) {
                console.error('[WS] Message Error:', err);
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
            }
        });

        ws.on('close', () => {
            console.log('[WS] Client disconnected');
            if (sessionId && sessions.has(sessionId)) {
                sessions.delete(sessionId);
            }
        });

        ws.on('error', (err) => {
            console.error('[WS] Socket error:', err);
        });
    });

    return wss;
}

/**
 * Handle incoming commands
 */
async function handleCommand(ws, data, audioChunks, sessionId, setSessionId) {
    const { type } = data;

    switch (type) {
        case 'start_session':
            console.log('[WS] Starting session...');

            // Verify JWT and extract role
            let userRole = 'viewer';
            if (data.token) {
                try {
                    const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'secret_key_change_me');
                    userRole = decoded.role || 'viewer';
                    console.log('[WS] Authenticated user, role:', userRole);
                } catch (jwtErr) {
                    console.warn('[WS] Invalid token, using default role');
                }
            }

            const newSessionId = createSession(userRole);
            setSessionId(newSessionId);
            console.log('[WS] Session created:', newSessionId, 'role:', userRole);

            const greeting = "Hello! I'm your inventory assistant. How can I help you today?";
            addToHistory(newSessionId, 'assistant', greeting);

            // Send text immediately
            const textMsg = JSON.stringify({ type: 'text', text: greeting, sessionId: newSessionId });
            console.log('[WS] Sending greeting:', textMsg);
            ws.send(textMsg);

            // Stream TTS audio
            await streamTTS(ws, greeting);
            break;

        case 'end_session':
            if (sessionId) {
                sessions.delete(sessionId);
            }
            ws.send(JSON.stringify({ type: 'session_ended' }));
            break;

        case 'audio_complete':
            // User finished speaking, process collected audio chunks
            if (audioChunks.length === 0) {
                ws.send(JSON.stringify({ type: 'error', message: 'No audio received' }));
                return;
            }

            ws.send(JSON.stringify({ type: 'status', status: 'processing' }));

            // Combine audio chunks into buffer
            const audioBuffer = Buffer.concat(audioChunks);

            // Process the audio through the pipeline
            await processAudio(ws, audioBuffer, sessionId);
            break;

        case 'confirm':
            // Handle tool confirmation
            await handleConfirmation(ws, data.tool, data.args);
            break;

        default:
            ws.send(JSON.stringify({ type: 'error', message: `Unknown command: ${type}` }));
    }
}

/**
 * Process audio through STT -> LLM -> TTS pipeline
 */
async function processAudio(ws, audioBuffer, sessionId) {
    const tempPath = path.join(__dirname, '../uploads', `temp_${Date.now()}.m4a`);

    try {
        // Save audio to temp file for Groq
        fs.writeFileSync(tempPath, audioBuffer);

        // STT with Groq
        ws.send(JSON.stringify({ type: 'status', status: 'transcribing' }));
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: "whisper-large-v3-turbo",
            response_format: "json",
            language: "en",
            temperature: 0.0
        });

        const userText = transcription.text;
        if (!userText || userText.trim().length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: "Didn't catch that, please try again." }));
            return;
        }

        // Send transcription to client
        ws.send(JSON.stringify({ type: 'transcription', text: userText }));

        // Add to history
        if (sessionId) addToHistory(sessionId, 'user', userText);

        // Build history for Gemini
        let historyParts = [];
        const session = sessionId ? getSession(sessionId) : null;
        if (session && session.history.length > 0) {
            let historyToUse = session.history;
            while (historyToUse.length > 0 && historyToUse[0].role === 'assistant') {
                historyToUse = historyToUse.slice(1);
            }
            historyParts = historyToUse.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));
        }

        // LLM with Gemini
        ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));

        const chat = model.startChat({
            tools: tools,
            history: historyParts,
            systemInstruction: {
                parts: [{
                    text: `You are a helpful voice assistant for Balaji Cleaning Products inventory management.

IMPORTANT CONTEXT:
- Locations available: "shop" (retail store) and "factory" (manufacturing unit).
- Language: Respond in the same language as the user (Hindi or English). Keep responses SHORT for voice.
- Products: Cleaning products like Harpic, bleach, floor cleaners, detergents, etc.

RULES:
1. For stock queries, use inventory_search tool with the product name.
2. If user doesn't specify location, search in "factory" by default.
3. For stock updates, use inventory_update and ALWAYS require confirmation.
4. Keep responses under 30 words for voice output.
5. Be natural and conversational.
6. NEVER mention tool names, function names, or internal system details to the user. Say things like "Let me check" or "Updating now" instead.
7. NEVER ask the user for their role. The system handles permissions automatically.
8. When user asks to count items or list items, use the appropriate tools silently.`
                }]
            }
        });

        const result = await chat.sendMessage(userText);
        const response = result.response;

        let finalResponseText = "";
        let actionPayload = null;

        // Check for function calls
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const name = call.name;
            const args = call.args;

            if (name === 'inventory_update') {
                // Auto-inject userRole from session
                const currentSession = sessionId ? getSession(sessionId) : null;
                const sessionRole = currentSession ? currentSession.userRole : 'viewer';
                args.userRole = sessionRole;

                actionPayload = {
                    type: 'CONFIRM',
                    tool: name,
                    args: args,
                    message: `Confirm update? ${args.action} ${args.quantityChange} ${args.itemName} at ${args.location}`
                };
                finalResponseText = actionPayload.message;
            } else {
                // Execute read tool via MCP
                const mcp = require('../services/mcpClient');
                const mcpResult = await mcp.callTool(name, args);
                const toolOutput = mcpResult.content && mcpResult.content[0] ? mcpResult.content[0].text : JSON.stringify(mcpResult);

                const result2 = await chat.sendMessage([{
                    functionResponse: {
                        name: name,
                        response: { name: name, content: { result: toolOutput } }
                    }
                }]);
                finalResponseText = result2.response.text();
            }
        } else {
            finalResponseText = response.text();
        }

        // Update history
        if (sessionId && finalResponseText) {
            addToHistory(sessionId, 'assistant', finalResponseText);
        }

        // Send text response
        ws.send(JSON.stringify({
            type: 'text',
            text: finalResponseText,
            action: actionPayload
        }));

        // Stream TTS
        await streamTTS(ws, finalResponseText);

    } catch (err) {
        console.error('[WS] Process Audio Error:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
    } finally {
        // Cleanup temp file
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) { }
    }
}

/**
 * Stream TTS audio chunks to client
 */
async function streamTTS(ws, text) {
    console.log('[TTS] Starting TTS for:', text?.substring(0, 50));
    console.log('[TTS] ElevenLabs client exists:', !!elevenLabs);

    if (!elevenLabs || !text) {
        console.log('[TTS] Skipping TTS - no client or text');
        ws.send(JSON.stringify({ type: 'audio_end' }));
        return;
    }

    try {
        ws.send(JSON.stringify({ type: 'audio_start' }));
        console.log('[TTS] Sent audio_start, calling ElevenLabs...');

        const audioStream = await elevenLabs.textToSpeech.convert(
            "21m00Tcm4TlvDq8ikWAM", // Rachel voice - warm & natural
            {
                text: text,
                model_id: "eleven_multilingual_v2",
                output_format: "mp3_44100_128"
            }
        );

        let chunkCount = 0;
        // Stream chunks as they arrive
        for await (const chunk of audioStream) {
            if (ws.readyState === ws.OPEN) {
                // Send binary audio chunk
                ws.send(chunk);
                chunkCount++;
            }
        }

        console.log('[TTS] Sent', chunkCount, 'audio chunks');
        ws.send(JSON.stringify({ type: 'audio_end' }));
    } catch (err) {
        console.error('[TTS] Error:', err.message);
        ws.send(JSON.stringify({ type: 'audio_end' }));
    }
}

/**
 * Handle tool confirmation
 */
async function handleConfirmation(ws, tool, args) {
    try {
        ws.send(JSON.stringify({ type: 'status', status: 'executing' }));

        const mcp = require('../services/mcpClient');
        const result = await mcp.callTool(tool, args);
        const toolOutput = result.content && result.content[0] ? result.content[0].text : JSON.stringify(result);

        ws.send(JSON.stringify({ type: 'confirm_result', success: true, message: toolOutput }));

        // Speak confirmation
        await streamTTS(ws, "Done!");
    } catch (err) {
        console.error('[WS] Confirmation Error:', err);
        ws.send(JSON.stringify({ type: 'confirm_result', success: false, error: err.message }));
    }
}

module.exports = { initWebSocketServer };
