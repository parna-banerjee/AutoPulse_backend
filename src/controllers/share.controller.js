const crypto = require("crypto");
const pool = require("../config/db");
const { supabase, DOCUMENTS_BUCKET } = require("../config/supabase");

const SHARE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour


// Creates a time-limited share token for a selected set of the user's docs.
const createShare = async (req, res) => {

    try {

        const userId = req.user.id;
        const { documentIds } = req.body;

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Select at least one document to share"
            });
        }

        // Keep only valid, distinct ids that actually belong to this user.
        const requested = [
            ...new Set(
                documentIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )
        ];

        if (requested.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid document selection"
            });
        }

        const placeholders = requested.map(() => "?").join(",");

        const [owned] = await pool.execute(
            `SELECT id
             FROM documents
             WHERE user_id = ?
               AND id IN (${placeholders})`,
            [userId, ...requested]
        );

        const ownedIds = owned.map((row) => row.id);

        if (ownedIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "None of the selected documents were found"
            });
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SHARE_TTL_MS);

        await pool.execute(
            `INSERT INTO document_shares (token, user_id, document_ids, expires_at)
             VALUES (?, ?, ?, ?)`,
            [token, userId, JSON.stringify(ownedIds), expiresAt]
        );

        res.status(201).json({
            success: true,
            message: "Share link created",
            data: {
                token,
                expires_at: expiresAt.toISOString(),
                ttl_seconds: SHARE_TTL_MS / 1000,
                document_count: ownedIds.length
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to create share link"
        });
    }
};


// Looks up a share token and returns { user_id } if valid, or writes an
// error response and returns null. Shared helper for the public routes.
const resolveShare = async (token, res) => {

    const [shares] = await pool.execute(
        `SELECT user_id, document_ids, expires_at
         FROM document_shares
         WHERE token = ?`,
        [token]
    );

    if (shares.length === 0) {
        res.status(404).json({
            success: false,
            message: "Share link not found"
        });
        return null;
    }

    if (new Date() > new Date(shares[0].expires_at)) {
        res.status(410).json({
            success: false,
            message: "This share link has expired"
        });
        return null;
    }

    const share = shares[0];

    // JSON columns usually arrive parsed, but guard for string form.
    let documentIds = share.document_ids;
    if (typeof documentIds === "string") {
        try {
            documentIds = JSON.parse(documentIds);
        } catch {
            documentIds = [];
        }
    }
    share.document_ids = Array.isArray(documentIds) ? documentIds : [];

    return share;
};


// Public: returns the shared user's documents (no auth required).
const getShare = async (req, res) => {

    try {

        const { token } = req.params;

        const share = await resolveShare(token, res);
        if (!share) {
            return;
        }

        const [owner] = await pool.execute(
            `SELECT name FROM users WHERE id = ?`,
            [share.user_id]
        );

        if (share.document_ids.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    owner_name: owner.length ? owner[0].name : null,
                    expires_at: share.expires_at,
                    documents: []
                }
            });
        }

        const placeholders = share.document_ids.map(() => "?").join(",");

        const [documents] = await pool.execute(
            `SELECT
                id,
                category,
                file_name,
                mime_type,
                document_type,
                extracted_data,
                extraction_status,
                created_at
             FROM documents
             WHERE user_id = ?
               AND id IN (${placeholders})
             ORDER BY created_at DESC`,
            [share.user_id, ...share.document_ids]
        );

        res.status(200).json({
            success: true,
            data: {
                owner_name: owner.length ? owner[0].name : null,
                expires_at: share.expires_at,
                documents
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to load shared documents"
        });
    }
};


// Public: returns a signed download URL for a document in the share.
const downloadSharedDocument = async (req, res) => {

    try {

        const { token, id } = req.params;

        const share = await resolveShare(token, res);
        if (!share) {
            return;
        }

        // The requested document must be part of this share.
        if (!share.document_ids.map(Number).includes(Number(id))) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        const [documents] = await pool.execute(
            `SELECT storage_path, file_name
             FROM documents
             WHERE id = ?
             AND user_id = ?`,
            [id, share.user_id]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        const { data, error } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .createSignedUrl(documents[0].storage_path, SIGNED_URL_EXPIRY, {
                download: documents[0].file_name
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
                file_name: documents[0].file_name,
                url: data.signedUrl
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


module.exports = {
    createShare,
    getShare,
    downloadSharedDocument
};
