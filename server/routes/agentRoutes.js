const express = require('express');
const router = express.Router(); // Trigger restart: MCP updated v4 Smart Update
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const authenticate = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

// Initialize Clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'placeholder' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'placeholder');
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

// ElevenLabs TTS Client (optional - will skip if no key)
const elevenLabs = process.env.ELEVENLABS_API_KEY
    ? new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
    : null;

// ========== SESSION MANAGEMENT ==========
// In-memory session store for conversation history
const sessions = new Map();

function createSession() {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions.set(sessionId, {
        history: [],
        createdAt: Date.now()
    });
    console.log(`[SESSION] Created: ${sessionId}`);
    return sessionId;
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

function clearSession(sessionId) {
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log(`[SESSION] Cleared: ${sessionId}`);
        return true;
    }
    return false;
}

function addToHistory(sessionId, role, content) {
    const session = sessions.get(sessionId);
    if (session) {
        session.history.push({ role, content });
        // Keep last 20 messages to avoid token overflow
        if (session.history.length > 20) {
            session.history = session.history.slice(-20);
        }
    }
}

// Cleanup old sessions (older than 30 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
        if (now - session.createdAt > 30 * 60 * 1000) {
            sessions.delete(id);
            console.log(`[SESSION] Auto-expired: ${id}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// Tool Definitions for Gemini (Manually synchronized with MCP for now)
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
                        location: { type: "STRING", enum: ["shop", "factory"] },
                        userRole: { type: "STRING" }
                    },
                    required: ["itemName", "quantityChange", "action", "location"]
                }
            },
            {
                name: "orders_list",
                description: "List recent orders with details. Can filter by status (pending/completed) or vendor.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        limit: { type: "NUMBER", description: "Number of orders to return (default 5)" },
                        status: { type: "STRING", enum: ["pending", "completed"] },
                        vendor: { type: "STRING", description: "Filter by vendor name" }
                    }
                }
            }
        ]
    }
];

router.post('/chat', upload.single('audio'), async (req, res) => {
    try {
        const requestId = Date.now().toString().slice(-6);
        console.log(`[${requestId}] REQ START: /chat`);
        console.log(`[${requestId}] Audio File:`, req.file ? `${req.file.path} (${req.file.size} bytes)` : 'NONE');
        console.log(`[${requestId}] Body:`, req.body);

        let audioPath = req.file ? req.file.path : null;
        let userText = req.body ? req.body.text : null;
        const sessionId = req.body ? req.body.sessionId : null;

        // 1. STT (Groq)
        if (audioPath) {
            try {
                // Ensure extension for Groq
                const newPath = audioPath + '.m4a';
                if (!fs.existsSync(newPath)) fs.renameSync(audioPath, newPath); // Prevent rename if already m4a
                audioPath = newPath;

                console.log(`[${requestId}] Transcribing ${audioPath}...`);

                // Check file size to avoid "too short" error
                const stats = fs.statSync(audioPath);
                if (stats.size < 1000) {
                    console.log(`[${requestId}] ERROR: Audio too small: ${stats.size} bytes`);
                    return res.status(400).json({
                        error: "Audio too short.",
                        text: "I didn't catch that."
                    });
                }

                const transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(audioPath),
                    model: "whisper-large-v3-turbo",
                    response_format: "json",
                    language: "en",
                    temperature: 0.0
                });
                console.log(`[${requestId}] Transcription raw:`, JSON.stringify(transcription));
                userText = transcription.text;
                console.log("Transcribed:", userText);
            } catch (sttError) {
                console.error("STT Error Detailed:", sttError);
                // Fallback or re-throw
                if (!userText) return res.status(500).json({ error: "STT Failed: " + sttError.message, stack: sttError.stack });
            } finally {
                // Delayed cleanup or immediate
                try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (e) { }
            }
        }

        if (!userText) {
            if (audioPath) {
                return res.status(400).json({ error: "Transcription empty.", details: "Audio received but STT returned no text." });
            } else {
                return res.status(400).json({ error: "No audio file received.", details: "req.file is missing." });
            }
        }

        // 2. Build conversation history for context
        let historyParts = [];
        const session = sessionId ? getSession(sessionId) : null;
        if (session && session.history.length > 0) {
            console.log(`[SESSION] Using ${session.history.length} messages for context`);

            // Gemini requires first message to be from 'user', so skip leading assistant messages
            let historyToUse = session.history;
            while (historyToUse.length > 0 && historyToUse[0].role === 'assistant') {
                historyToUse = historyToUse.slice(1);
            }

            historyParts = historyToUse.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));
        }

        // 3. Chat with Gemini (with history)
        const chat = model.startChat({
            tools: tools,
            history: historyParts,
            systemInstruction: {
                parts: [{
                    text: `You are a helpful voice assistant for Balaji Cleaning Products inventory management.

IMPORTANT CONTEXT:
- Locations available: "shop" (retail store) and "factory" (manufacturing unit). No other locations exist.
- Language: Respond in the same language as the user (Hindi or English). Keep responses SHORT for voice.
- Products: Cleaning products like Harpic, bleach, floor cleaners, detergents, etc.

RULES:
1. For stock queries, use inventory_search tool with the product name.
2. If user doesn't specify location, search in "factory" by default.
3. For stock updates, use inventory_update and ALWAYS require confirmation.
4. Keep responses under 30 words for voice output.
5. Be natural and conversational.` }]
            }
        });

        const result = await chat.sendMessage(userText);
        const response = result.response;
        console.log("Response:", response);

        let finalResponseText = "";
        let actionPayload = null;

        // Check for Function Call
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            const call = functionCalls[0];
            const name = call.name;
            const args = call.args;

            console.log("Tool invoked:", name);

            if (name === 'inventory_update') {
                // WRITE ACTION -> Return Confirmation Payload
                actionPayload = {
                    type: 'CONFIRM',
                    tool: name,
                    args: args,
                    message: `Confirm update? ${args.action} ${args.quantityChange} ${args.itemName} at ${args.location}`
                };
                finalResponseText = actionPayload.message;
            } else {
                // READ ACTION -> Call MCP
                const mcp = require('../services/mcpClient');
                // Dynamically call the tool on MCP server
                const mcpResult = await mcp.callTool(name, args);

                // Parse MCP result (it returns clean content usually)
                // MCP SDK returns { content: [{ type: 'text', text: '...' }] }
                const toolOutput = mcpResult.content && mcpResult.content[0] ? mcpResult.content[0].text : JSON.stringify(mcpResult);

                console.log("MCP Result:", toolOutput);

                // Send Result back to Gemini
                const result2 = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: name,
                            response: { name: name, content: { result: toolOutput } }
                        }
                    }
                ]);
                finalResponseText = result2.response.text();
            }
        } else {
            // Normal text response
            finalResponseText = response.text();
        }

        // 3. ElevenLabs TTS Generation
        let audioBase64 = null;
        if (elevenLabs && finalResponseText) {
            try {
                console.log("Generating TTS with ElevenLabs...");
                const audioStream = await elevenLabs.textToSpeech.convert(
                    "EXAVITQu4vr4xnSDxMaLEXAVITQu4vr4xnSDxMaL",
                    {
                        text: finalResponseText,
                        modelId: "eleven_flash_v2_5",
                        outputFormat: "mp3_44100_128"
                    }
                );

                // Collect stream into buffer
                const chunks = [];
                for await (const chunk of audioStream) {
                    chunks.push(chunk);
                }
                const audioBuffer = Buffer.concat(chunks);
                audioBase64 = audioBuffer.toString('base64');
                console.log("TTS generated, size:", audioBuffer.length);
            } catch (ttsError) {
                console.error("ElevenLabs TTS Error:", ttsError.message || ttsError);
                // Continue without audio - text will be displayed
            }
        }

        // 4. Update session history with this exchange
        if (sessionId && session) {
            addToHistory(sessionId, 'user', userText);
            if (finalResponseText) {
                addToHistory(sessionId, 'assistant', finalResponseText);
            }
        }

        res.json({
            text: finalResponseText,
            transcription: userText,
            action: actionPayload,
            audio: audioBase64 // Base64 MP3 or null
        });

    } catch (err) {
        console.error("Agent Route Error:", err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Confirmation Endpoint
router.post('/confirm', authenticate, async (req, res) => {
    try {
        const { tool, args } = req.body;

        if (!tool || !args) return res.status(400).json({ error: "Missing tool or args" });

        // SECURITY: Override userRole with authenticated user's role
        if (req.user && req.user.role) {
            console.log(`[AUTH] Overriding userRole: ${args.userRole} -> ${req.user.role}`);
            args.userRole = req.user.role;
        }

        console.log("Confirming Tool Execution:", tool, args);

        const mcp = require('../services/mcpClient');
        const result = await mcp.callTool(tool, args);

        const toolOutput = result.content && result.content[0] ? result.content[0].text : JSON.stringify(result);

        // TODO: Generate TTS for success message "Done!"
        res.json({ success: true, message: toolOutput });

    } catch (err) {
        console.error("Confirmation Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ========== SESSION ENDPOINTS ==========

// Start a new conversation session
router.post('/session/start', async (req, res) => {
    try {
        const sessionId = createSession();
        const greeting = "Hello! I'm your inventory assistant. How can I help you today?";

        // Add greeting to history
        addToHistory(sessionId, 'assistant', greeting);

        // Generate TTS for greeting
        let audioBase64 = null;
        if (elevenLabs) {
            try {
                const audioStream = await elevenLabs.textToSpeech.convert(
                    "EXAVITQu4vr4xnSDxMaLEXAVITQu4vr4xnSDxMaL",
                    {
                        text: greeting,
                        modelId: "eleven_flash_v2_5",
                        outputFormat: "mp3_44100_128"
                    }
                );
                const chunks = [];
                for await (const chunk of audioStream) {
                    chunks.push(chunk);
                }
                audioBase64 = Buffer.concat(chunks).toString('base64');
            } catch (ttsError) {
                console.error("Greeting TTS Error:", ttsError.message);
            }
        }

        res.json({
            sessionId,
            text: greeting,
            audio: audioBase64
        });
    } catch (err) {
        console.error("Session Start Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// End a conversation session
router.post('/session/end', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId required" });
        }

        const cleared = clearSession(sessionId);
        res.json({
            success: cleared,
            message: cleared ? "Session ended. Goodbye!" : "Session not found"
        });
    } catch (err) {
        console.error("Session End Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
