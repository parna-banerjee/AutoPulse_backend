const pool = require("../config/db");

// A requester may act on a target user if it's themselves, or if they are the
// MAIN_MEMBER that owns the target (target.main_member_id === requester.id).
const canAccessUser = async (requesterId, targetId) => {

    if (Number(requesterId) === Number(targetId)) {
        return true;
    }

    const [rows] = await pool.execute(
        "SELECT main_member_id FROM users WHERE id = ?",
        [targetId]
    );

    if (rows.length === 0) {
        return false;
    }

    return Number(rows[0].main_member_id) === Number(requesterId);
};

// Resolves the target user id for a request: the requested memberId if the
// caller is allowed to act on it, otherwise throws. Falls back to self.
const resolveTargetUserId = async (req) => {

    const requested = req.body?.memberId ?? req.query?.memberId;

    if (requested === undefined || requested === null || requested === "") {
        return req.user.id;
    }

    const targetId = Number(requested);

    const allowed = await canAccessUser(req.user.id, targetId);

    if (!allowed) {
        const err = new Error("You do not have access to this member");
        err.statusCode = 403;
        throw err;
    }

    return targetId;
};

module.exports = {
    canAccessUser,
    resolveTargetUserId
};
