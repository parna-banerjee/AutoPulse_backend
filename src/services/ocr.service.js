const { genai, GEMINI_MODEL } = require("../config/gemini");
const { Type } = require("@google/genai");

// A single schema that covers both document types. Gemini fills the
// relevant block (medicines for prescriptions, metrics for lab reports)
// and leaves the other empty based on document_type.
const RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        document_type: {
            type: Type.STRING,
            enum: ["prescription", "lab_report", "unknown"]
        },
        medicines: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    strength: { type: Type.STRING },
                    dose: { type: Type.STRING },
                    frequency: { type: Type.STRING },
                    duration: { type: Type.STRING }
                },
                propertyOrdering: [
                    "name",
                    "strength",
                    "dose",
                    "frequency",
                    "duration"
                ],
                required: [
                    "name",
                    "strength",
                    "dose",
                    "frequency",
                    "duration"
                ]
            }
        },
        metrics: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    value: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    reference_range: { type: Type.STRING }
                },
                propertyOrdering: [
                    "name",
                    "value",
                    "unit",
                    "reference_range"
                ],
                required: [
                    "name",
                    "value",
                    "unit",
                    "reference_range"
                ]
            }
        }
    },
    required: ["document_type"]
};

const PROMPT = `You are a medical document parser. Read the attached document and extract structured data.

Rules:
- Decide document_type: "prescription" if it lists medicines to take, "lab_report" if it lists test results/metrics, otherwise "unknown".
- If it is a prescription, fill "medicines" and leave "metrics" empty.
- If it is a lab_report, fill "metrics" and leave "medicines" empty.
- Extract EVERY item you can find. Include one array entry per medicine / per metric. Do not skip any.
- Copy values verbatim and concisely from the document. Do not add explanations, alternatives, or commentary to any field.
- For each medicine field, put ONLY that piece of information:
  name (drug name), strength (e.g. "500 mg"), dose (e.g. "1 tablet"),
  frequency (e.g. "twice daily"), duration (e.g. "5 days").
- For metric "value", output only the numeric value (a number).
- If a field is not present in the document, use an empty string.
- Do not invent, infer, or guess any data that is not written in the document.

Example: the line
  "Paracetamol 500 mg - 1 tablet - twice daily - 5 days"
must be split into separate fields:
  { "name": "Paracetamol", "strength": "500 mg", "dose": "1 tablet", "frequency": "twice daily", "duration": "5 days" }
Never put more than one of these pieces into a single field.`;


const MAX_RETRIES = 3;
const RETRYABLE_STATUS = [429, 500, 503];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Sends a file buffer to Gemini and returns the extracted structured data.
// Retries transient errors (rate limit / overload) with exponential backoff.
const extractDocumentData = async (buffer, mimeType) => {

    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {

        try {

            const response = await genai.models.generateContent({
                model: GEMINI_MODEL,
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                inlineData: {
                                    mimeType,
                                    data: buffer.toString("base64")
                                }
                            },
                            { text: PROMPT }
                        ]
                    }
                ],
                config: {
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: RESPONSE_SCHEMA
                }
            });

            const text = response.text;

            if (!text) {
                throw new Error("Gemini returned an empty response");
            }

            return JSON.parse(text);

        } catch (error) {

            lastError = error;

            const status = error.status || error.code;
            const isRetryable = RETRYABLE_STATUS.includes(Number(status));

            if (!isRetryable || attempt === MAX_RETRIES - 1) {
                throw error;
            }

            // 1s, 2s, 4s ...
            await sleep(1000 * Math.pow(2, attempt));
        }
    }

    throw lastError;
};


module.exports = {
    extractDocumentData
};
