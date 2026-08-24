const pool = require("../config/db");
const { supabase, DOCUMENTS_BUCKET } = require("../config/supabase");
const { canAccessUser, resolveTargetUserId } = require("../utils/access");

const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

// Fetches a document by :id and authorizes the caller against its owner
// (self, or the main member who owns that member). Returns { doc } or a flag.
const loadAccessibleDocument = async (req, columns) => {
    const { id } = req.params;
    const [rows] = await pool.execute(
        `SELECT user_id, ${columns} FROM documents WHERE id = ?`,
        [id]
    );
    if (rows.length === 0) {
        return { notFound: true };
    }
    const allowed = await canAccessUser(req.user.id, rows[0].user_id);
    if (!allowed) {
        return { forbidden: true };
    }
    return { doc: rows[0] };
};

// Gemini can read images and PDFs inline. Skip extraction for anything else.
const EXTRACTABLE_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif"
];


const uploadDocument = async (req, res) => {

    try {

        // Owner is the selected member (if the caller may act for them),
        // otherwise the caller themselves.
        const userId = await resolveTargetUserId(req);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "File is required"
            });
        }

        const { category } = req.body;

        const originalName = req.file.originalname;

        // Keep the file organised per user and avoid name clashes.
        const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${userId}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .upload(storagePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error(uploadError);
            return res.status(500).json({
                success: false,
                message: "Failed to upload file to storage"
            });
        }

        // Extraction runs in the background worker. Extractable files start
        // as 'pending'; anything else is 'skipped' so the worker ignores it.
        const isExtractable = EXTRACTABLE_MIME_TYPES.includes(req.file.mimetype);
        const extractionStatus = isExtractable ? "pending" : "skipped";

        const [result] = await pool.execute(
            `INSERT INTO documents
            (
                user_id,
                category,
                file_name,
                storage_path,
                mime_type,
                size_bytes,
                extraction_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                category || null,
                originalName,
                storagePath,
                req.file.mimetype,
                req.file.size,
                extractionStatus
            ]
        );

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: {
                id: result.insertId,
                category: category || null,
                file_name: originalName,
                mime_type: req.file.mimetype,
                size_bytes: req.file.size,
                extraction_status: extractionStatus
            }
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to upload document"
        });
    }
};


const getDocuments = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);

        const [documents] = await pool.execute(
            `SELECT
                id,
                category,
                file_name,
                mime_type,
                size_bytes,
                document_type,
                extracted_data,
                extraction_status,
                extraction_error,
                created_at
             FROM documents
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        res.status(200).json({
            success: true,
            data: documents
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch documents"
        });
    }
};


// Aggregates numeric metrics from all of the user's extracted lab reports
// into a time series per metric name, for charting.
const getMetrics = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);

        const [rows] = await pool.execute(
            `SELECT extracted_data, created_at
             FROM documents
             WHERE user_id = ?
               AND extraction_status = 'done'
               AND document_type = 'lab_report'
               AND extracted_data IS NOT NULL
             ORDER BY created_at ASC`,
            [userId]
        );

        const series = {};

        for (const row of rows) {

            let data = row.extracted_data;

            // JSON columns usually arrive parsed, but guard for string form.
            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                } catch {
                    continue;
                }
            }

            const metrics = data && data.metrics;

            if (!Array.isArray(metrics)) {
                continue;
            }

            for (const metric of metrics) {

                if (!metric || !metric.name) {
                    continue;
                }

                const value = Number(metric.value);

                if (Number.isNaN(value)) {
                    continue;
                }

                if (!series[metric.name]) {
                    series[metric.name] = {
                        name: metric.name,
                        unit: metric.unit || "",
                        reference_range: metric.reference_range || "",
                        points: []
                    };
                }

                series[metric.name].points.push({
                    date: row.created_at,
                    value
                });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                metrics: Object.values(series)
            }
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch metrics"
        });
    }
};


const getDocument = async (req, res) => {

    try {

        const { doc, notFound, forbidden } = await loadAccessibleDocument(
            req,
            `id, category, file_name, mime_type, size_bytes, document_type,
             extracted_data, extraction_status, extraction_error, created_at`
        );

        if (notFound) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }
        if (forbidden) {
            return res.status(403).json({ success: false, message: "You do not have access to this document" });
        }

        // Strip the internal owner id from the response.
        delete doc.user_id;

        res.status(200).json({
            success: true,
            data: doc
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch document"
        });
    }
};


const downloadDocument = async (req, res) => {

    try {

        const { doc, notFound, forbidden } = await loadAccessibleDocument(
            req,
            "storage_path, file_name"
        );

        if (notFound) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }
        if (forbidden) {
            return res.status(403).json({ success: false, message: "You do not have access to this document" });
        }

        const { storage_path, file_name } = doc;

        const { data, error } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .createSignedUrl(storage_path, SIGNED_URL_EXPIRY, {
                download: file_name
            });

        if (error) {
            console.error(error);
            return res.status(500).json({
                success: false,
                message: "Failed to generate download link"
            });
        }

        res.status(200).json({
            success: true,
            data: {
                file_name,
                url: data.signedUrl,
                expires_in: SIGNED_URL_EXPIRY
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to download document"
        });
    }
};


// Re-queues a document for extraction. The background worker picks it up;
// this does not run Gemini synchronously.
const extractDocument = async (req, res) => {

    try {

        const { id } = req.params;
        const { doc, notFound, forbidden } = await loadAccessibleDocument(
            req,
            "mime_type"
        );

        if (notFound) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }
        if (forbidden) {
            return res.status(403).json({ success: false, message: "You do not have access to this document" });
        }

        if (!EXTRACTABLE_MIME_TYPES.includes(doc.mime_type)) {
            return res.status(400).json({
                success: false,
                message: "This file type cannot be extracted"
            });
        }

        // Reset the job so the worker processes it again.
        await pool.execute(
            `UPDATE documents
             SET extraction_status = 'pending',
                 extraction_attempts = 0,
                 extraction_error = NULL
             WHERE id = ?`,
            [id]
        );

        res.status(202).json({
            success: true,
            message: "Document queued for extraction",
            data: {
                id: Number(id),
                extraction_status: "pending"
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to queue document for extraction"
        });
    }
};


// Rename a document's display file name.
const updateDocument = async (req, res) => {

    try {

        const { id } = req.params;
        const { file_name } = req.body;

        if (!file_name || !String(file_name).trim()) {
            return res.status(400).json({
                success: false,
                message: "File name is required"
            });
        }

        const { notFound, forbidden } = await loadAccessibleDocument(req, "id");

        if (notFound) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }
        if (forbidden) {
            return res.status(403).json({ success: false, message: "You do not have access to this document" });
        }

        const trimmed = String(file_name).trim().slice(0, 255);

        await pool.execute(
            "UPDATE documents SET file_name = ? WHERE id = ?",
            [trimmed, id]
        );

        res.status(200).json({
            success: true,
            message: "Document renamed",
            data: { id: Number(id), file_name: trimmed }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to rename document"
        });
    }
};


const deleteDocument = async (req, res) => {

    try {

        const { id } = req.params;
        const { doc, notFound, forbidden } = await loadAccessibleDocument(
            req,
            "storage_path"
        );

        if (notFound) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }
        if (forbidden) {
            return res.status(403).json({ success: false, message: "You do not have access to this document" });
        }

        const { error: storageError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .remove([doc.storage_path]);

        if (storageError) {
            console.error(storageError);
            return res.status(500).json({
                success: false,
                message: "Failed to delete file from storage"
            });
        }

        await pool.execute(
            `DELETE FROM documents
             WHERE id = ?`,
            [id]
        );

        res.status(200).json({
            success: true,
            message: "Document deleted successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to delete document"
        });
    }
};


module.exports = {
    uploadDocument,
    getDocuments,
    getMetrics,
    getDocument,
    downloadDocument,
    extractDocument,
    updateDocument,
    deleteDocument
};
