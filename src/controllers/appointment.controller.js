const pool = require("../config/db");
const {
    canAccessUser,
    resolveTargetUserId,
    resolveViewableUserId
} = require("../utils/access");

// Multiple appointments per user. Dates/times stored as strings to avoid
// timezone drift.

const getAppointments = async (req, res) => {

    try {

        const userId = await resolveViewableUserId(req);

        const [rows] = await pool.execute(
            `SELECT id, title, appt_date, appt_time, duration_mins, location, notes
             FROM appointments
             WHERE user_id = ?
             ORDER BY appt_date ASC, appt_time ASC`,
            [userId]
        );

        res.status(200).json({ success: true, data: rows });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to fetch appointments" });
    }
};


const createAppointment = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);
        const { title, date, time, durationMins, location, notes } = req.body;

        if (!title || !date || !time) {
            return res.status(400).json({
                success: false,
                message: "Title, date and time are required"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO appointments
            (user_id, title, appt_date, appt_time, duration_mins, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                title,
                date,
                time,
                Number(durationMins) || 30,
                location || null,
                notes || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Appointment added",
            data: { id: result.insertId }
        });

    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to add appointment" });
    }
};


// Loads an appointment by :id and checks the caller may mutate its owner.
const loadForMutate = async (req) => {
    const [rows] = await pool.execute(
        "SELECT id, user_id FROM appointments WHERE id = ?",
        [req.params.id]
    );
    if (rows.length === 0) return { notFound: true };
    if (!(await canAccessUser(req.user.id, rows[0].user_id))) return { forbidden: true };
    return { appt: rows[0] };
};


const updateAppointment = async (req, res) => {

    try {

        const { appt, notFound, forbidden } = await loadForMutate(req);
        if (notFound) return res.status(404).json({ success: false, message: "Appointment not found" });
        if (forbidden) return res.status(403).json({ success: false, message: "You do not have access to this appointment" });

        const { title, date, time, durationMins, location, notes } = req.body;
        if (!title || !date || !time) {
            return res.status(400).json({ success: false, message: "Title, date and time are required" });
        }

        await pool.execute(
            `UPDATE appointments
             SET title = ?, appt_date = ?, appt_time = ?,
                 duration_mins = ?, location = ?, notes = ?
             WHERE id = ?`,
            [title, date, time, Number(durationMins) || 30, location || null, notes || null, appt.id]
        );

        res.status(200).json({ success: true, message: "Appointment updated" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to update appointment" });
    }
};


const deleteAppointment = async (req, res) => {

    try {

        const { appt, notFound, forbidden } = await loadForMutate(req);
        if (notFound) return res.status(404).json({ success: false, message: "Appointment not found" });
        if (forbidden) return res.status(403).json({ success: false, message: "You do not have access to this appointment" });

        await pool.execute("DELETE FROM appointments WHERE id = ?", [appt.id]);

        res.status(200).json({ success: true, message: "Appointment removed" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to remove appointment" });
    }
};


module.exports = {
    getAppointments,
    createAppointment,
    updateAppointment,
    deleteAppointment
};
