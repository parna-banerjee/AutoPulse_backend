const multer = require("multer");

// Catches any request to a route that does not exist.
const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
};


// Central error handler. Express (v5) forwards both thrown errors and
// rejected promises from async handlers here, so nothing crashes silently.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {

    // Always log the full error to the server console so it is visible.
    console.error("--- Error ---");
    console.error(`${req.method} ${req.originalUrl}`);
    console.error(err);

    // Multer (file upload) specific errors.
    if (err instanceof multer.MulterError) {

        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File is too large (max 10 MB)"
            });
        }

        return res.status(400).json({
            success: false,
            message: `File upload error: ${err.message}`
        });
    }

    // Malformed JSON body.
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON in request body"
        });
    }

    const statusCode = err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error"
    });
};


module.exports = {
    notFound,
    errorHandler
};
