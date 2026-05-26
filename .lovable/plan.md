## Rotate `CRON_SECRET` and update the cron job

1. **Generate a new random value** for `CRON_SECRET` (e.g. `openssl rand -hex 32`) and update the existing `CRON_SECRET` secret with it (you'll paste the value into the secure form — I never see it).

2. **Verify the endpoint** `src/routes/api/public/hooks/check-reminders.ts` reads `process.env.CRON_SECRET` from the `apikey` header and rejects mismatches with 401. Adjust if needed.

3. **Reschedule the cron job** in the database:
   - `cron.unschedule(...)` the existing reminder job
   - `cron.schedule(...)` it again with the same cron expression, but with the `apikey` header set to the new `CRON_SECRET` value (entered via the secure SQL run, not committed to migrations).

4. **Confirm it runs**: check `cron.job_run_details` after the next scheduled tick to make sure the call returns 200, not 401.

### Technical notes
- The cron SQL is run via the Supabase insert/SQL tool (not a migration) since it contains the secret value.
- No app/UI code changes — backend only.
