const pool = require("../config/db");
const { resolveTargetUserId, resolveViewableUserId } = require("../utils/access");

const getProfile = async (req, res) => {

    try {

        // Any family member can view another family member's profile.
        const userId = await resolveViewableUserId(req);

        const [profiles] = await pool.execute(
            `SELECT
                u.id,
                u.name,
                u.email,
                u.role,
                u.relationship,
                p.date_of_birth,
                p.gender,
                p.height,
                p.weight,
                p.blood_group
             FROM users u
             LEFT JOIN member_profiles p
                ON u.id = p.user_id
             WHERE u.id = ?`,
            [userId]
        );

        if (profiles.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Profile not found"
            });
        }

        res.status(200).json({
            success: true,
            data: profiles[0]
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch profile"
        });
    }
};


const updateProfile = async (req, res) => {

    try {

        const userId = await resolveTargetUserId(req);

        const {
            name,
            dateOfBirth,
            gender,
            height,
            weight,
            bloodGroup
        } = req.body;

        // Name lives on the users table.
        if (name && String(name).trim()) {
            await pool.execute(
                "UPDATE users SET name = ? WHERE id = ?",
                [String(name).trim(), userId]
            );
        }

        const [existingProfile] = await pool.execute(
            `SELECT id
             FROM member_profiles
             WHERE user_id = ?`,
            [userId]
        );

        if (existingProfile.length === 0) {

            await pool.execute(
                `INSERT INTO member_profiles
                (
                    user_id,
                    date_of_birth,
                    gender,
                    height,
                    weight,
                    blood_group
                )
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    dateOfBirth || null,
                    gender || null,
                    height || null,
                    weight || null,
                    bloodGroup || null
                ]
            );

        } else {

            await pool.execute(
                `UPDATE member_profiles
                 SET
                    date_of_birth = ?,
                    gender = ?,
                    height = ?,
                    weight = ?,
                    blood_group = ?
                 WHERE user_id = ?`,
                [
                    dateOfBirth || null,
                    gender || null,
                    height || null,
                    weight || null,
                    bloodGroup || null,
                    userId
                ]
            );
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully"
        });

    } catch (error) {

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to update profile"
        });
    }
};


module.exports = {
    getProfile,
    updateProfile
};