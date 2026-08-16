const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

const DOCUMENTS_BUCKET = process.env.SUPABASE_BUCKET || "documents";

module.exports = {
    supabase,
    DOCUMENTS_BUCKET
};
