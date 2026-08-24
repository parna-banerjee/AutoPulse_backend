const nodemailer = require("nodemailer");

const SUBJECT = "AutoPulse - Login OTP";
const bodyText = (otp) =>
    `Your login OTP is ${otp}. This OTP is valid for 5 minutes.`;


// Preferred on hosts that block SMTP ports (e.g. Render free tier): Brevo's
// HTTP API over port 443. Requires BREVO_API_KEY and a verified sender.
const sendViaBrevo = async (email, otp) => {

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json",
                accept: "application/json"
            },
            body: JSON.stringify({
                sender: {
                    email: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    name: "AutoPulse"
                },
                to: [{ email }],
                subject: SUBJECT,
                textContent: bodyText(otp)
            }),
            signal: controller.signal
        });

        if (!res.ok) {
            const detail = await res.text();
            throw new Error(
                `Brevo send failed (${res.status}): ${detail.slice(0, 200)}`
            );
        }
    } finally {
        clearTimeout(timer);
    }
};


// Fallback: SMTP via nodemailer. Works locally; may be blocked on some hosts.
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
});

const sendViaSmtp = async (email, otp) => {

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error(
            "Email is not configured (set BREVO_API_KEY, or EMAIL_USER/EMAIL_PASSWORD)"
        );
    }

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: SUBJECT,
        text: bodyText(otp)
    });
};


const sendOTPEmail = async (email, otp) => {
    // Prefer the HTTP API when configured; otherwise fall back to SMTP.
    if (process.env.BREVO_API_KEY) {
        return sendViaBrevo(email, otp);
    }
    return sendViaSmtp(email, otp);
};

module.exports = {
    sendOTPEmail
};
