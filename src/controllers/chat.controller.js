const pool = require("../config/db");
const { genai, GEMINI_MODEL } = require("../config/gemini");
const { resolveViewableUserId } = require("../utils/access");
const { logAudit } = require("../utils/audit");

// A less-contended model to fall back to when the primary is overloaded (503).
const FALLBACK_MODEL = "gemini-flash-lite-latest";

const generateWithFallback = async (contents, systemInstruction) => {
    const config = { systemInstruction, temperature: 0.3 };
    try {
        return await genai.models.generateContent({ model: GEMINI_MODEL, contents, config });
    } catch (err) {
        if (GEMINI_MODEL !== FALLBACK_MODEL) {
            return await genai.models.generateContent({ model: FALLBACK_MODEL, contents, config });
        }
        throw err;
    }
};

const parseJson = (v) => {
    if (v && typeof v === "string") {
        try {
            return JSON.parse(v);
        } catch {
            return null;
        }
    }
    return v;
};

// Gathers everything we know about a user into a compact context object.
const buildContext = async (userId) => {

    const [profiles] = await pool.execute(
        `SELECT u.name, u.role, p.date_of_birth, p.gender, p.height, p.weight, p.blood_group
         FROM users u
         LEFT JOIN member_profiles p ON u.id = p.user_id
         WHERE u.id = ?`,
        [userId]
    );

    const [docs] = await pool.execute(
        `SELECT file_name, category, document_type, extracted_data, created_at
         FROM documents
         WHERE user_id = ? AND extraction_status = 'done'
         ORDER BY created_at DESC`,
        [userId]
    );

    const [appts] = await pool.execute(
        `SELECT title, appt_date, appt_time, location
         FROM appointments
         WHERE user_id = ?
         ORDER BY appt_date ASC, appt_time ASC`,
        [userId]
    );

    return {
        profile: profiles[0] || null,
        documents: docs.map((d) => ({
            file_name: d.file_name,
            category: d.category,
            document_type: d.document_type,
            date: d.created_at,
            data: parseJson(d.extracted_data)
        })),
        appointments: appts
    };
};


const chat = async (req, res) => {

    try {

        const userId = await resolveViewableUserId(req);
        const { message, history } = req.body;

        if (!message || !String(message).trim()) {
            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        const context = await buildContext(userId);

        const systemInstruction =
            "You are AutoPulse's health assistant. Answer the user's question " +
            "using ONLY the health records provided below. If the answer isn't " +
            "in the records, say you don't have that information. Be concise and " +
            "clear, use plain language, and add a brief reminder that this is not " +
            "a substitute for professional medical advice when giving health " +
            "interpretations.\n\nHEALTH RECORDS (JSON):\n" +
            JSON.stringify(context);

        // Keep the last few turns for continuity.
        const contents = [];
        if (Array.isArray(history)) {
            for (const h of history.slice(-8)) {
                contents.push({
                    role: h.role === "assistant" ? "model" : "user",
                    parts: [{ text: String(h.text || "") }]
                });
            }
        }
        contents.push({ role: "user", parts: [{ text: String(message) }] });

        const response = await generateWithFallback(contents, systemInstruction);

        res.status(200).json({
            success: true,
            data: { answer: response.text || "Sorry, I couldn't generate a response." }
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error(error);
        logAudit({
            level: "error",
            source: "chat",
            action: "failed",
            message: error.message,
            userId: req.user && req.user.id,
            metadata: { status: error.status || error.code }
        });
        res.status(500).json({ success: false, message: "Failed to get a response" });
    }
};

// Streams the answer token-by-token as plain text (chunked response).
const chatStream = async (req, res) => {

    try {

        const userId = await resolveViewableUserId(req);
        const { message, history } = req.body;

        if (!message || !String(message).trim()) {
            return res.status(400).json({ success: false, message: "Message is required" });
        }

        const context = await buildContext(userId);
        const systemInstruction =
            "You are AutoPulse's health assistant. Answer using ONLY the health " +
            "records provided. If the answer isn't there, say you don't have that " +
            "information. Be concise and clear, and remind the user this is not a " +
            "substitute for professional medical advice for health interpretations." +
            "\n\nHEALTH RECORDS (JSON):\n" + JSON.stringify(context);

        const contents = [];
        if (Array.isArray(history)) {
            for (const h of history.slice(-8)) {
                contents.push({
                    role: h.role === "assistant" ? "model" : "user",
                    parts: [{ text: String(h.text || "") }]
                });
            }
        }
        contents.push({ role: "user", parts: [{ text: String(message) }] });

        const config = { systemInstruction, temperature: 0.3 };

        // Open the stream (with model fallback) and pull the first chunk before
        // sending headers, so a 503 can still return a JSON error.
        const openIterator = async (model) => {
            const stream = await genai.models.generateContentStream({ model, contents, config });
            const iter = stream[Symbol.asyncIterator]();
            const first = await iter.next();
            return { iter, first };
        };

        let handle;
        try {
            handle = await openIterator(GEMINI_MODEL);
        } catch (err) {
            if (GEMINI_MODEL !== FALLBACK_MODEL) {
                handle = await openIterator(FALLBACK_MODEL);
            } else {
                throw err;
            }
        }

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering

        if (!handle.first.done && handle.first.value?.text) {
            res.write(handle.first.value.text);
        }
        for (let r = await handle.iter.next(); !r.done; r = await handle.iter.next()) {
            if (r.value?.text) {
                res.write(r.value.text);
            }
        }
        res.end();

    } catch (error) {

        logAudit({
            level: "error",
            source: "chat",
            action: "stream_failed",
            message: error.message,
            userId: req.user && req.user.id,
            metadata: { status: error.status || error.code }
        });
        if (!res.headersSent) {
            const status = error.statusCode || 500;
            return res.status(status).json({ success: false, message: error.message || "Failed to get a response" });
        }
        console.error(error);
        res.end();
    }
};

module.exports = { chat, chatStream };
