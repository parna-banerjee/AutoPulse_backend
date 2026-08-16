const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const genai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

module.exports = {
    genai,
    GEMINI_MODEL
};
