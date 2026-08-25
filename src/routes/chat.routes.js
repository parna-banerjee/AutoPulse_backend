const express = require("express");
const { chat, chatStream } = require("../controllers/chat.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", authenticate, chat);
router.post("/stream", authenticate, chatStream);

module.exports = router;
