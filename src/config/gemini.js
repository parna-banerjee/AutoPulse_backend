const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

// Per-request timeout (ms). Without it, a stalled request hangs the worker
// forever, leaving documents stuck in "processing".
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 60000;

const genai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        timeout: GEMINI_TIMEOUT_MS
    }
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

module.exports = {
    genai,
    GEMINI_MODEL
};
