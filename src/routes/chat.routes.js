const express = require("express");
const { chat } = require("../controllers/chat.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", authenticate, chat);

module.exports = router;
