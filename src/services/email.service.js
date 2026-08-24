const nodemailer = require("nodemailer");

// Timeouts so a stalled SMTP connection fails fast instead of hanging the
// request forever (e.g. missing creds or a host that blocks SMTP).
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

const sendOTPEmail = async (email, otp) => {

    // Fail clearly if email isn't configured, rather than stalling on SMTP.
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error(
            "Email is not configured (set EMAIL_USER and EMAIL_PASSWORD)"
        );
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Medical App - Login OTP",
        text: `Your login OTP is ${otp}. This OTP is valid for 5 minutes.`
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendOTPEmail
};
