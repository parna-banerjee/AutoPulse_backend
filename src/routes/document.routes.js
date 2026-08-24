const express = require("express");
const multer = require("multer");

const {
    uploadDocument,
    getDocuments,
    getMetrics,
    getDocument,
    downloadDocument,
    extractDocument,
    updateDocument,
    deleteDocument
} = require("../controllers/document.controller");

const {
    authenticate
} = require("../middleware/auth.middleware");

const router = express.Router();

// Store the file in memory so we can stream the buffer straight to Supabase.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

router.post(
    "/",
    authenticate,
    upload.single("file"),
    uploadDocument
);

router.get(
    "/",
    authenticate,
    getDocuments
);

// Must be before "/:id" so it isn't matched as an id.
router.get(
    "/metrics",
    authenticate,
    getMetrics
);

router.get(
    "/:id/download",
    authenticate,
    downloadDocument
);

router.get(
    "/:id",
    authenticate,
    getDocument
);

router.post(
    "/:id/extract",
    authenticate,
    extractDocument
);

router.patch(
    "/:id",
    authenticate,
    updateDocument
);

router.delete(
    "/:id",
    authenticate,
    deleteDocument
);

module.exports = router;
