const pool = require("../config/db");
const { resolveTargetUserId } = require("../utils/access");

// One appointment per user (self or a managed member). Dates/times are stored
// as strings to avoid timezone drift.

const getAppointment = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);

        const [rows] = await pool.execute(
            `SELECT title, appt_date, appt_time, duration_mins, location, notes
             FROM appointments
             WHERE user_id = ?`,
            [userId]
        );

        res.status(200).json({
            success: true,
            data: rows.length ? rows[0] : null
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch appointment" });
    }
};


const upsertAppointment = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);

        const { title, date, time, durationMins, location, notes } = req.body;

        if (!title || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "Title, date and time are required"
            });
        }

        const values = [
            title,
            date,
            time,
            Number(durationMins) || 30,
            location || null,
            notes || null
        ];

        const [existing] = await pool.execute(
            "SELECT id FROM appointments WHERE user_id = ?",
            [userId]
        );

        if (existing.length === 0) {
            await pool.execute(
                `INSERT INTO appointments
                (user_id, title, appt_date, appt_time, duration_mins, location, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, ...values]
            );
        } else {
            await pool.execute(
                `UPDATE appointments
                 SET title = ?, appt_date = ?, appt_time = ?,
                     duration_mins = ?, location = ?, notes = ?
                 WHERE user_id = ?`,
                [...values, userId]
            );
        }

        res.status(200).json({
            success: true,
            message: "Appointment saved"
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to save appointment" });
    }
};


const deleteAppointment = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);

        await pool.execute(
            "DELETE FROM appointments WHERE user_id = ?",
            [userId]
        );

        res.status(200).json({
            success: true,
            message: "Appointment cleared"
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to clear appointment" });
    }
};


module.exports = {
    getAppointment,
    upsertAppointment,
    deleteAppointment
};
