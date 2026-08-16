const express = require("express");

const {
    addMember,
    getMembers
} = require("../controllers/member.controller");

const {
    authenticate,
    mainMemberOnly
} = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
    "/",
    authenticate,
    mainMemberOnly,
    addMember
);

router.get(
    "/",
    authenticate,
    mainMemberOnly,
    getMembers
);

module.exports = router;