const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const emailService = require("./email.service");


const registerMainMember = async (name, email, password) => {

    // Store and compare emails lowercased so lookups are case-insensitive
    // on both MySQL and Postgres.
    const normalizedEmail = email.toLowerCase();

    const [existingUsers] = await pool.execute(
        "SELECT id FROM users WHERE LOWER(email) = ?",
        [normalizedEmail]
    );


    if (existingUsers.length > 0) {
        throw new Error("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
        `INSERT INTO users
        (name, email, password_hash, role)
        VALUES (?, ?, ?, 'MAIN_MEMBER')`,
        [name, normalizedEmail, passwordHash]
    );

    const user = {
        id: result.insertId,
        name,
        email: normalizedEmail,
        role: "MAIN_MEMBER"
    };

    const token = generateToken(user);

    return {
        user,
        token
    };
};
 
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
    };

const sendMemberOTP = async (email) => {

    const [users] = await pool.execute(
        `SELECT id, name, email, role
         FROM users
         WHERE LOWER(email) = ?
         AND role = 'MEMBER'`,
        [email.toLowerCase()]
    );

    if (users.length === 0) {
        throw new Error("Member not found");
    }

    const otp = generateOTP();

    const otpExpiry = new Date(
        Date.now() + 5 * 60 * 1000
    );

    await pool.execute(
        `UPDATE users
         SET otp = ?, otp_expiry = ?
         WHERE id = ?`,
        [
            otp,
            otpExpiry,
            users[0].id
        ]
    );

    await emailService.sendOTPEmail(
        email,
        otp
    );

    return {
        message: "OTP sent successfully"
    };
};
const verifyMemberOTP = async (email, otp) => {

    const [users] = await pool.execute(
        `SELECT *
         FROM users
         WHERE LOWER(email) = ?
         AND role = 'MEMBER'`,
        [email.toLowerCase()]
    );

    if (users.length === 0) {
        throw new Error("Member not found");
    }

    const user = users[0];

    if (!user.otp || !user.otp_expiry) {
        throw new Error("OTP not generated");
    }

    if (user.otp !== otp) {
        throw new Error("Invalid OTP");
    }

    if (new Date() > new Date(user.otp_expiry)) {
        throw new Error("OTP expired");
    }

    // Clear OTP after successful login
    await pool.execute(
        `UPDATE users
         SET otp = NULL,
             otp_expiry = NULL
         WHERE id = ?`,
        [user.id]
    );

    const token = generateToken(user);

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            main_member_id: user.main_member_id
        },
        token
    };
};

const loginMainMember = async (name, password) => {

    const [users] = await pool.execute(
        `SELECT *
         FROM users
         WHERE LOWER(name) = ?
         AND role = 'MAIN_MEMBER'`,
        [name.toLowerCase()]
    );

    if (users.length === 0) {
        throw new Error("Invalid name or password");
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatch) {
        throw new Error("Invalid name or password");
    }

    const token = generateToken(user);

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        },
        token
    };
};


module.exports = {
    registerMainMember,
    loginMainMember,
    sendMemberOTP,
    verifyMemberOTP
};