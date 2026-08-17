const express = require("express");
const cors = require("cors");
const profileRoutes = require("./routes/profile.routes");
const authRoutes = require("./routes/auth.routes");
const memberRoutes = require("./routes/member.routes");
const documentRoutes = require("./routes/document.routes");
const shareRoutes = require("./routes/share.routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/shares", shareRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Medical App Backend is running"
    });
});

// Error handling must be registered last, after all routes.
app.use(notFound);
app.use(errorHandler);

module.exports = app;