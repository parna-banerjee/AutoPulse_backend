const express = require("express");

const {
    getAppointment,
    upsertAppointment,
    deleteAppointment
} = require("../controllers/appointment.controller");

const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", authenticate, getAppointment);
router.put("/", authenticate, upsertAppointment);
router.delete("/", authenticate, deleteAppointment);

module.exports = router;
