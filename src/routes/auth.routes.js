const express = require("express");


const {
    register,
    login,
    sendOTP,
    verifyOTP
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.post("/send-otp", sendOTP);

router.post("/verify-otp", verifyOTP);

module.exports = router;