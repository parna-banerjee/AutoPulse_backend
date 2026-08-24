const pool = require("../config/db");

const addMember = async (req, res) => {

    try {

        const { name, email, relationship } = req.body;

        if (!name || !email || !relationship) {
            return res.status(400).json({
                success: false,
                message: "Name, email and relationship are required"
            });
        }

        const mainMemberId = req.user.id;

        // Normalize email so lookups are case-insensitive on MySQL and Postgres.
        const normalizedEmail = email.toLowerCase();

        const [existingUser] = await pool.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            [normalizedEmail]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO users
            (name, email, role, main_member_id, relationship)
            VALUES (?, ?, 'MEMBER', ?, ?)`,
            [
                name,
                normalizedEmail,
                mainMemberId,
                relationship
            ]
        );

        res.status(201).json({
            success: true,
            message: "Member added successfully",
            data: {
                id: result.insertId,
                name,
                email: normalizedEmail,
                relationship,
                role: "MEMBER",
                main_member_id: mainMemberId
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to add member"
        });
    }
};


const getMembers = async (req, res) => {

    try {

        const mainMemberId = req.user.id;

        const [members] = await pool.execute(
            `SELECT id, name, email, role, created_at
             FROM users
             WHERE main_member_id = ?
             AND role = 'MEMBER'
             ORDER BY created_at DESC`,
            [mainMemberId]
        );

        res.status(200).json({
            success: true,
            data: members
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch members"
        });
    }
};


module.exports = {
    addMember,
    getMembers
};