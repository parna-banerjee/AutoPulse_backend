const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const sendOTPEmail = async (email, otp) => {

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