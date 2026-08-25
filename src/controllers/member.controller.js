const pool = require("../config/db");
const { familyRootOf } = require("../utils/access");

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


// Any family member can list the whole family (main member + all members).
const getMembers = async (req, res) => {

    try {

        const root = await familyRootOf(req.user.id);

        const [members] = await pool.execute(
            `SELECT id, name, email, role, relationship, created_at
             FROM users
             WHERE id = ? OR main_member_id = ?
             ORDER BY role DESC, created_at ASC`,
            [root, root]
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


// Main member only. Deletes a member that belongs to this main member.
const deleteMember = async (req, res) => {

    try {

        const mainMemberId = req.user.id;
        const { id } = req.params;

        const [rows] = await pool.execute(
            "SELECT id FROM users WHERE id = ? AND main_member_id = ? AND role = 'MEMBER'",
            [id, mainMemberId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        // Documents/profile/appointments cascade via their FKs.
        await pool.execute("DELETE FROM users WHERE id = ?", [id]);

        res.status(200).json({
            success: true,
            message: "Member removed"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to remove member"
        });
    }
};


module.exports = {
    addMember,
    getMembers,
    deleteMember
};