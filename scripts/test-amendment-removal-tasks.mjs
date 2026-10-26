// Isolated PostgreSQL tests. No network connection or production credentials are used.
// Install the test runtime with:
// npm install --prefix .tmp-contract-db --no-save --package-lock=false @electric-sql/pglite
import { PGlite } from '../.tmp-contract-db/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = ts.createSourceFile('types.ts', fs.readFileSync('src/integrations/supabase/types.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const database = source.statements.find(n => ts.isTypeAliasDeclaration(n) && n.name.text === 'Database').type;
const property = (node, name) => node.members.find(m => m.name?.getText(source).replaceAll('"', '') === name)?.type;
const tables = property(property(database, 'public'), 'Tables');
const db = new PGlite();
try {
  await db.exec("CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-1111-1111-111111111111'::uuid$$;");
  const names = ['customers','contract_terms','Contract','billboards','paused_billboards','paused_billboard_replacements','shared_billboards','friend_billboard_rentals','activity_log',
    'billboard_history','installation_tasks','installation_task_items','print_tasks','print_task_items','cutout_tasks','cutout_task_items','removal_tasks','removal_task_items'];
  for (const name of names) {
    const row = property(property(tables, name), 'Row');
    assert(row, `Missing generated schema for ${name}`);
    // Start from the schema before this migration, even after types are regenerated.
    const addedColumns = ['installation_tasks','removal_tasks'].includes(name) ? ['amendment_number'] : name === 'Contract' ? ['edit_revision']
      : name === 'paused_billboards' ? ['price_snapshot', 'lifecycle_state', 'resumed_at'] : [];
    const definitions = row.members.filter(m => !addedColumns.includes(m.name.getText(source).replaceAll('"', ''))).map(m => {
      const field = m.name.getText(source).replaceAll('"', '');
      const type = m.type.getText(source);
      let sqlType = /\bnumber\b/.test(type) ? 'numeric' : /\bboolean\b/.test(type) ? 'boolean' : /Json|\[\]/.test(type) ? 'jsonb' : 'text';
      if (['id','task_id','user_id','paused_billboard_id','friend_company_id','team_id'].includes(field) && sqlType === 'text') sqlType = 'uuid';
      if (['pause_date','original_start_date','original_end_date'].includes(field)) sqlType = 'date';
      const defaultValue = field === 'id' && sqlType === 'uuid' ? ' DEFAULT gen_random_uuid() PRIMARY KEY' : '';
      return `"${field}" ${sqlType}${defaultValue}`;
    });
    await db.exec(`CREATE TABLE public."${name}" (${definitions.join(',')});`);
  }
  await db.exec('CREATE UNIQUE INDEX ON public.friend_billboard_rentals(contract_number,billboard_id);');
  await db.exec(fs.readFileSync('supabase/migrations/20260908010000_contract_edit_atomic.sql', 'utf8'));

  await db.exec(fs.readFileSync('supabase/migrations/20260909020000_remove_contract_edit_booked_check.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261001010000_zero_pause_refund_contribution.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261026010000_contract_board_lifecycle_addenda.sql','utf8'));

  await db.exec(fs.readFileSync('supabase/migrations/20261026020000_numbered_contract_amendments.sql','utf8'));

  await db.exec(`CREATE TABLE installation_teams(id uuid PRIMARY KEY, sizes text[],cities text[],friend_company_ids uuid[],priority integer);
    CREATE UNIQUE INDEX ON installation_task_items(task_id,billboard_id);
    CREATE TRIGGER auto_create_tasks_trigger AFTER INSERT OR UPDATE ON "Contract" FOR EACH ROW EXECUTE FUNCTION auto_create_installation_tasks();`);
  await db.exec(fs.readFileSync('supabase/migrations/20261026030000_amendment_installation_tasks.sql','utf8'));

  await db.exec(fs.readFileSync('supabase/migrations/20261026040000_amendment_removal_tasks.sql','utf8'));
  await db.exec(`INSERT INTO installation_teams VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',ARRAY['3x4'],NULL,NULL,10);
    INSERT INTO billboards("ID","Size","Faces_Count") VALUES(1,'3x4',2),(2,'3x4',2),(3,'3x4',2),(4,'3x4',2);
    INSERT INTO "Contract"("Contract_Number","Contract Date",billboard_ids,"Total") VALUES(1,'2026-10-01','1,2',2000);
    UPDATE installation_task_items SET status='completed',design_face_a='saved-design';
    UPDATE installation_tasks SET status='completed';`);
  const removals = async() => (await db.query('SELECT i.*,t.amendment_number,t.contract_id,t.team_id FROM removal_task_items i JOIN removal_tasks t ON t.id=i.task_id ORDER BY i.billboard_id')).rows;
  // Installed removal: separate numbered work; original evidence remains completed.
  await db.exec(`UPDATE "Contract" SET billboard_ids='2',"Total"=1000 WHERE "Contract_Number"=1;`);
  assert.equal((await removals()).length,1);
  assert.equal((await removals())[0].amendment_number,1);
  assert.equal((await removals())[0].design_face_a,'saved-design');
  assert.equal((await db.query("SELECT status FROM installation_task_items WHERE billboard_id=1")).rows[0].status,'completed');
  // A new pending board removed later needs no physical removal.
  await db.exec(`UPDATE "Contract" SET billboard_ids='2,3' WHERE "Contract_Number"=1;`);
  await db.exec(`UPDATE "Contract" SET billboard_ids='2' WHERE "Contract_Number"=1;`);
  assert.equal((await removals()).length,1);
  // Multi-step saves use the final board set, and rollback leaves no removal work.
  await db.exec(`BEGIN; UPDATE "Contract" SET billboard_ids='' WHERE "Contract_Number"=1;
    UPDATE "Contract" SET billboard_ids='2',"Total"=1100 WHERE "Contract_Number"=1; COMMIT;`);
  assert.equal((await removals()).length,1);
  await db.exec(`BEGIN; UPDATE "Contract" SET billboard_ids='' WHERE "Contract_Number"=1; ROLLBACK;`);
  assert.equal((await removals()).length,1);
  await db.exec(`UPDATE "Contract" SET billboard_ids='' WHERE "Contract_Number"=1;`);
  assert.equal((await removals()).length,2);
  assert.equal((await removals())[1].amendment_number,5);
  await db.exec(`UPDATE "Contract" SET billboard_ids='' WHERE "Contract_Number"=1;`);
  assert.equal((await removals()).length,2);
  // Existing pending removal is reassigned without duplicating it or losing evidence.
  await db.exec(`INSERT INTO "Contract"("Contract_Number","Contract Date",billboard_ids,"Total") VALUES(2,'2026-10-01','4',1000);
    UPDATE installation_task_items SET status='completed' WHERE billboard_id=4;
    INSERT INTO removal_tasks(id,contract_id,status) VALUES('dddddddd-dddd-dddd-dddd-dddddddddddd',2,'pending');
    INSERT INTO removal_task_items(task_id,billboard_id,status,notes) VALUES('dddddddd-dddd-dddd-dddd-dddddddddddd',4,'pending','keep evidence');`);
  await db.exec(`UPDATE "Contract" SET billboard_ids='' WHERE "Contract_Number"=2;`);
  const reused=(await removals()).filter(i=>Number(i.billboard_id)===4);
  assert.equal(reused.length,1); assert.equal(reused[0].amendment_number,1); assert.equal(reused[0].notes,'keep evidence');
  console.log('Amendment removal integration checks passed');
} finally { await db.close(); }
