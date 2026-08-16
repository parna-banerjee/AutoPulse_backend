const authService = require("../services/auth.service");

const register = async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const result = await authService.registerMainMember(
            name,
            email,
            password
        );

        res.status(201).json({
            success: true,
            message: "Main member registered successfully",
            data: result
        });

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const sendOTP = async (req, res) => {

    try {

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const result = await authService.sendMemberOTP(email);

        res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const login = async (req, res) => {

    try {

        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({
                success: false,
                message: "Name and password are required"
            });
        }

        const result = await authService.loginMainMember(
            name,
            password
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: result
        });

    } catch (error) {

        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};
const verifyOTP = async (req, res) => {

    try {

        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const result = await authService.verifyMemberOTP(
            email,
            otp
        );

        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            data: result
        });

    } catch (error) {

        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    register,
    login,
    sendOTP,
    verifyOTP
};