const express = require("express");

const {
    getAppointments,
    createAppointment,
    updateAppointment,
    deleteAppointment
} = require("../controllers/appointment.controller");

const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", authenticate, getAppointments);
router.post("/", authenticate, createAppointment);
router.put("/:id", authenticate, updateAppointment);
router.delete("/:id", authenticate, deleteAppointment);

module.exports = router;
