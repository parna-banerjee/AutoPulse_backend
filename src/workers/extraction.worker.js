const pool = require("../config/db");
const { supabase, DOCUMENTS_BUCKET } = require("../config/supabase");
const { extractDocumentData } = require("../services/ocr.service");

const POLL_INTERVAL_MS = Number(process.env.EXTRACTION_POLL_MS) || 5000;
const MAX_ATTEMPTS = Number(process.env.EXTRACTION_MAX_ATTEMPTS) || 3;

// Prevents two ticks from overlapping if a batch runs longer than the interval.
let running = false;

// Ids this process is actively working on right now. Any row in 'processing'
// that is NOT in this set belongs to a previous (dead/slept) process and is
// safe to requeue — this self-heals jobs stranded when Render sleeps mid-job.
const inFlight = new Set();


// Requeue 'processing' jobs that this process isn't actually working on.
const reclaimStrandedJobs = async () => {

    if (inFlight.size === 0) {
        const [result] = await pool.execute(
            `UPDATE documents
             SET extraction_status = 'pending'
             WHERE extraction_status = 'processing'`
        );
        if (result.affectedRows > 0) {
            console.log(`[extraction] reclaimed ${result.affectedRows} stranded job(s)`);
        }
        return;
    }

    const ids = [...inFlight];
    const placeholders = ids.map(() => "?").join(",");
    await pool.execute(
        `UPDATE documents
         SET extraction_status = 'pending'
         WHERE extraction_status = 'processing'
           AND id NOT IN (${placeholders})`,
        ids
    );
};


// Atomically claims the next pending job. Returns the job row or null.
const claimNextJob = async () => {

    const [rows] = await pool.execute(
        `SELECT id, storage_path, mime_type
         FROM documents
         WHERE extraction_status = 'pending'
           AND extraction_attempts < ?
         ORDER BY created_at ASC
         LIMIT 1`,
        [MAX_ATTEMPTS]
    );

    if (rows.length === 0) {
        return null;
    }

    const job = rows[0];

    // Conditional claim: the row is only ours if it is still 'pending'.
    // This is what makes it safe to run more than one worker later.
    const [result] = await pool.execute(
        `UPDATE documents
         SET extraction_status = 'processing',
             extraction_attempts = extraction_attempts + 1
         WHERE id = ?
           AND extraction_status = 'pending'`,
        [job.id]
    );

    if (result.affectedRows === 0) {
        // Another worker grabbed it first.
        return null;
    }

    inFlight.add(job.id);
    return job;
};


const processJob = async (job) => {

    try {

        const { data, error } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .download(job.storage_path);

        if (error) {
            throw new Error(`Storage download failed: ${error.message}`);
        }

        const buffer = Buffer.from(await data.arrayBuffer());

        const extracted = await extractDocumentData(buffer, job.mime_type);

        await pool.execute(
            `UPDATE documents
             SET extraction_status = 'done',
                 document_type = ?,
                 extracted_data = ?,
                 extraction_error = NULL
             WHERE id = ?`,
            [
                extracted.document_type,
                JSON.stringify(extracted),
                job.id
            ]
        );

        console.log(`[extraction] done id=${job.id}`);

    } catch (err) {

        console.error(`[extraction] failed id=${job.id}: ${err.message}`);

        // Out of attempts -> give up ('failed'); otherwise requeue ('pending').
        // CASE (not MySQL's IF) so the SQL works on both MySQL and Postgres.
        await pool.execute(
            `UPDATE documents
             SET extraction_status = CASE
                     WHEN extraction_attempts >= ? THEN 'failed'
                     ELSE 'pending'
                 END,
                 extraction_error = ?
             WHERE id = ?`,
            [
                MAX_ATTEMPTS,
                err.message.slice(0, 1000),
                job.id
            ]
        );
    } finally {
        inFlight.delete(job.id);
    }
};


const tick = async () => {

    if (running) {
        return;
    }

    running = true;

    try {

        // Recover jobs stranded by a slept/dead process before claiming new ones.
        await reclaimStrandedJobs();

        let job;

        // Drain everything claimable this tick, one at a time.
        while ((job = await claimNextJob())) {
            await processJob(job);
        }

    } catch (err) {

        console.error(`[extraction] worker tick error: ${err.message}`);

    } finally {

        running = false;
    }
};


const startExtractionWorker = async () => {

    // Recover jobs left mid-flight by a previous crash/restart.
    try {
        const [result] = await pool.execute(
            `UPDATE documents
             SET extraction_status = 'pending'
             WHERE extraction_status = 'processing'`
        );

        if (result.affectedRows > 0) {
            console.log(
                `[extraction] recovered ${result.affectedRows} interrupted job(s)`
            );
        }
    } catch (err) {
        console.error(`[extraction] recovery failed: ${err.message}`);
    }

    setInterval(() => {
        tick();
    }, POLL_INTERVAL_MS);

    console.log(`[extraction] worker started (poll ${POLL_INTERVAL_MS}ms)`);
};


module.exports = {
    startExtractionWorker
};
