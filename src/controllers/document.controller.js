const pool = require("../config/db");
const { supabase, DOCUMENTS_BUCKET } = require("../config/supabase");

const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

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

        const userId = req.user.id;

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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to upload document"
        });
    }
};


const getDocuments = async (req, res) => {

    try {

        const userId = req.user.id;

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

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch documents"
        });
    }
};


const getDocument = async (req, res) => {

    try {

        const userId = req.user.id;
        const { id } = req.params;

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
             WHERE id = ?
             AND user_id = ?`,
            [id, userId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        res.status(200).json({
            success: true,
            data: documents[0]
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

        const userId = req.user.id;
        const { id } = req.params;

        const [documents] = await pool.execute(
            `SELECT storage_path, file_name
             FROM documents
             WHERE id = ?
             AND user_id = ?`,
            [id, userId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        const { storage_path, file_name } = documents[0];

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

        const userId = req.user.id;
        const { id } = req.params;

        const [documents] = await pool.execute(
            `SELECT mime_type
             FROM documents
             WHERE id = ?
             AND user_id = ?`,
            [id, userId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        if (!EXTRACTABLE_MIME_TYPES.includes(documents[0].mime_type)) {
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
             WHERE id = ?
             AND user_id = ?`,
            [id, userId]
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


const deleteDocument = async (req, res) => {

    try {

        const userId = req.user.id;
        const { id } = req.params;

        const [documents] = await pool.execute(
            `SELECT storage_path
             FROM documents
             WHERE id = ?
             AND user_id = ?`,
            [id, userId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        const { error: storageError } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .remove([documents[0].storage_path]);

        if (storageError) {
            console.error(storageError);
            return res.status(500).json({
                success: false,
                message: "Failed to delete file from storage"
            });
        }

        await pool.execute(
            `DELETE FROM documents
             WHERE id = ?
             AND user_id = ?`,
            [id, userId]
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
    getDocument,
    downloadDocument,
    extractDocument,
    deleteDocument
};
