const express = require("express");

const {
    createShare,
    getShare,
    downloadSharedDocument
} = require("../controllers/share.controller");

const {
    authenticate
} = require("../middleware/auth.middleware");

const router = express.Router();

// Creating a share requires auth; viewing/downloading via a token is public.
router.post(
    "/",
    authenticate,
    createShare
);

router.get(
    "/:token",
    getShare
);

router.get(
    "/:token/documents/:id/download",
    downloadSharedDocument
);

module.exports = router;
