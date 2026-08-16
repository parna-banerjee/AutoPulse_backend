require("dotenv").config();

const app = require("./src/app");
const pool = require("./src/config/db");
const { startExtractionWorker } = require("./src/workers/extraction.worker");

const PORT = process.env.PORT || 5000;

const startServer = async () => {

    try {

        const connection = await pool.getConnection();

        console.log("MySQL connected successfully");

        connection.release();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Start the background extraction worker (in-process).
        startExtractionWorker();

    } catch (error) {

        console.error("Database connection failed:");
        console.error(error);

        process.exit(1);
    }
};

// Catch errors thrown outside the request cycle so the process
// logs the real cause instead of dying silently.
process.on("unhandledRejection", (reason) => {
    console.error("--- Unhandled Promise Rejection ---");
    console.error(reason);
});

process.on("uncaughtException", (error) => {
    console.error("--- Uncaught Exception ---");
    console.error(error);
    // An uncaught exception leaves the app in an unknown state; exit so a
    // process manager (nodemon / pm2) can restart it cleanly.
    process.exit(1);
});

startServer();