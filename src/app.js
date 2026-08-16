const express = require("express");
const cors = require("cors");
const profileRoutes = require("./routes/profile.routes");
const authRoutes = require("./routes/auth.routes");
const memberRoutes = require("./routes/member.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/profile", profileRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Medical App Backend is running"
    });
});

module.exports = app;