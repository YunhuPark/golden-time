// Disposable PostgreSQL regression: simulate restored tables with RLS disabled
// and inherited broad grants. No production database or patient records used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = path.join(__dirname, '../supabase/migrations/20261118000000_secure_private_tables.sql');
const tables = ['favorites', 'medical_profiles', 'visit_history', 'reviews'];
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';

test('restored private tables deny anonymous access and isolate every owner write', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      CREATE TABLE public.hospital_specialties(hpid text PRIMARY KEY);
      INSERT INTO public.hospital_specialties VALUES('synthetic-hospital');
      GRANT ALL ON public.hospital_specialties TO PUBLIC,anon,authenticated,service_role;
      ALTER TABLE public.hospital_specialties ENABLE ROW LEVEL SECURITY;
      CREATE POLICY reference_public_read ON public.hospital_specialties FOR SELECT USING(true);`);
    for (const table of tables) {
      await db.exec(`CREATE TABLE public.${table}(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL, marker text);
        GRANT ALL ON public.${table} TO PUBLIC, anon, authenticated;
        CREATE POLICY stale_allow_all ON public.${table} FOR ALL USING(true) WITH CHECK(true);
        INSERT INTO public.${table}(user_id,marker) VALUES ('${a}','owner-a'),('${b}','owner-b');`);
    }
    await db.exec(fs.readFileSync(migration, 'utf8'));
    await db.exec('SET ROLE anon');
    for (const table of tables) {
      if (table !== 'reviews') await assert.rejects(db.query(`SELECT * FROM public.${table}`), /permission denied/);
      await assert.rejects(db.query(`INSERT INTO public.${table}(user_id) VALUES($1)`, [a]), /permission denied/);
      await assert.rejects(db.query(`UPDATE public.${table} SET marker='attack'`), /permission denied/);
      await assert.rejects(db.query(`DELETE FROM public.${table}`), /permission denied/);
      await assert.rejects(db.query(`TRUNCATE public.${table}`), /permission denied/);
    }
    assert.equal((await db.query('SELECT * FROM public.reviews')).rows.length, 2);
    assert.equal((await db.query('SELECT * FROM public.hospital_specialties')).rows.length, 1);
    await assert.rejects(db.query('TRUNCATE public.hospital_specialties'), /permission denied/);
    await assert.rejects(db.query("INSERT INTO public.hospital_specialties VALUES('untrusted')"), /permission denied/);
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false);`);
    await assert.rejects(db.query('TRUNCATE public.hospital_specialties'), /permission denied/);
    for (const table of tables) {
      const visible = (await db.query(`SELECT * FROM public.${table}`)).rows;
      assert.equal(visible.length, table === 'reviews' ? 2 : 1);
      await assert.rejects(db.query(`INSERT INTO public.${table}(user_id) VALUES($1)`, [b]), /row-level security/);
      await db.query(`INSERT INTO public.${table}(user_id,marker) VALUES($1,'own-new')`, [a]);
      if (table === 'favorites') {
        await assert.rejects(db.query(`UPDATE public.${table} SET marker='change'`), /permission denied/);
      } else {
        assert.equal((await db.query(`UPDATE public.${table} SET marker='attack' WHERE user_id=$1 RETURNING id`, [b])).rows.length, 0);
        await assert.rejects(db.query(`UPDATE public.${table} SET user_id=$1 WHERE user_id=$2`, [b, a]), /row-level security/);
        assert.equal((await db.query(`UPDATE public.${table} SET marker='own-update' WHERE user_id=$1 RETURNING id`, [a])).rows.length, 2);
      }
      assert.equal((await db.query(`DELETE FROM public.${table} WHERE user_id=$1 RETURNING id`, [b])).rows.length, 0);
      assert.equal((await db.query(`DELETE FROM public.${table} WHERE user_id=$1 RETURNING id`, [a])).rows.length, 2);
      await assert.rejects(db.query(`TRUNCATE public.${table}`), /permission denied/);
    }
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE service_role');
    await db.query("INSERT INTO public.hospital_specialties VALUES('trusted-crawler')");
    assert.equal((await db.query('SELECT * FROM public.hospital_specialties')).rows.length, 2);
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname='stale_allow_all'")).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity")).rows[0].n, 0);
    await db.exec(fs.readFileSync(migration, 'utf8'));
  } finally { await db.close(); }
});
