const crypto = require("crypto");
const pool = require("../config/db");
const { supabase, DOCUMENTS_BUCKET } = require("../config/supabase");

const SHARE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour


// Creates a time-limited share token for the logged-in user's documents.
const createShare = async (req, res) => {

    try {

        const userId = req.user.id;
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + SHARE_TTL_MS);

        await pool.execute(
            `INSERT INTO document_shares (token, user_id, expires_at)
             VALUES (?, ?, ?)`,
            [token, userId, expiresAt]
        );

        res.status(201).json({
            success: true,
            message: "Share link created",
            data: {
                token,
                expires_at: expiresAt.toISOString(),
                ttl_seconds: SHARE_TTL_MS / 1000
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
        `SELECT user_id, expires_at
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

    return shares[0];
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
             ORDER BY created_at DESC`,
            [share.user_id]
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
