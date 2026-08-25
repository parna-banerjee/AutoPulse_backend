const express = require("express");

const {
    addMember,
    getMembers,
    deleteMember
} = require("../controllers/member.controller");

const {
    authenticate,
    mainMemberOnly
} = require("../middleware/auth.middleware");

const router = express.Router();

// Any family member can view the family list.
router.get(
    "/",
    authenticate,
    getMembers
);

// Only the main member can add or remove members.
router.post(
    "/",
    authenticate,
    mainMemberOnly,
    addMember
);

router.delete(
    "/:id",
    authenticate,
    mainMemberOnly,
    deleteMember
);

module.exports = router;
