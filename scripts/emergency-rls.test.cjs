// Run with @electric-sql/pglite available on NODE_PATH. Uses a disposable local
// PostgreSQL engine; no production credentials or network database connection.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('anonymous capability RPC isolates owners and denies table enumeration/tampering', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),
        ('00000000-0000-4000-8000-000000000002');`);
    await db.exec(fs.readFileSync(path.join(__dirname,
      '../supabase/migrations/20261113000000_secure_emergency_shares.sql'), 'utf8'));
    const a = '00000000-0000-4000-8000-000000000001';
    const b = '00000000-0000-4000-8000-000000000002';
    const token = '11111111-1111-4111-8111-111111111111';
    const expired = '22222222-2222-4222-8222-222222222222';
    await db.exec(`INSERT INTO public.emergency_shares(user_id,share_token,medical_data,expires_at)
      VALUES ('${a}', '${token}', '{"allergies":"synthetic"}', now()+interval '1 hour'),
      ('${b}', '${expired}', '{}', now()-interval '1 hour'); SET ROLE anon;`);
    await assert.rejects(db.query('SELECT * FROM public.emergency_shares'), /permission denied/);
    await assert.rejects(db.query("UPDATE public.emergency_shares SET medical_data='{}'"), /permission denied/);
    assert.equal((await db.query('SELECT * FROM public.read_emergency_share($1)', ['wrong'])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM public.read_emergency_share($1)', [expired])).rows.length, 0);
    const rows = (await db.query('SELECT * FROM public.read_emergency_share($1)', [token])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].view_count, 1);
    assert.equal(rows[0].medical_data.allergies, 'synthetic');
    assert.equal('user_id' in rows[0], false);
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query('SELECT * FROM public.emergency_shares')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM public.emergency_shares WHERE share_token=$1', [token])).rows.length, 0);
    await assert.rejects(db.query("UPDATE public.emergency_shares SET medical_data='{}'"), /permission denied/);
    await assert.rejects(db.query(`INSERT INTO public.emergency_shares(user_id,medical_data)
      VALUES ($1,'{}')`, [a]), /row-level security/);
    assert.equal((await db.query('SELECT * FROM public.read_emergency_share($1)', [token])).rows[0].view_count, 2);
  } finally { await db.close(); }
});
