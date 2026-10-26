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
    const addedColumns = name === 'installation_tasks' ? ['amendment_number'] : name === 'Contract' ? ['edit_revision']
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
  await db.exec(`INSERT INTO installation_teams VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',ARRAY['3x4'],NULL,NULL,10),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',ARRAY['4x5'],NULL,NULL,20);
    INSERT INTO billboards("ID","Size","Faces_Count") VALUES(1,'3x4',2),(2,'3x4',2),(3,'4x5',1),(4,'3x4',2),(5,'3x4',2);
    INSERT INTO "Contract"("Contract_Number","Customer Name","Contract Date",billboard_ids,"Total") VALUES(1,'Customer','2026-10-01','1',1000);`);
  const tasks = async() => (await db.query('SELECT * FROM installation_tasks ORDER BY amendment_number NULLS FIRST,team_id')).rows;
  const items = async() => (await db.query('SELECT i.billboard_id,t.amendment_number,t.status parent_status FROM installation_task_items i JOIN installation_tasks t ON t.id=i.task_id ORDER BY i.billboard_id')).rows;
  assert.equal((await tasks()).length,1);
  const originalId=(await tasks())[0].id;
  await db.exec(`UPDATE installation_task_items SET status='completed'; UPDATE installation_tasks SET status='completed';
    UPDATE "Contract" SET billboard_ids='1,2,3',"Total"=3000 WHERE "Contract_Number"=1;`);
  assert.deepEqual((await tasks()).map(t=>t.amendment_number),[null,1,1]);
  assert.equal((await tasks()).find(t=>t.id===originalId).status,'completed');
  assert.deepEqual((await items()).map(i=>[Number(i.billboard_id),i.amendment_number]),[[1,null],[2,1],[3,1]]);
  // Financial-only updates create no installation task; adding while pending gets a new amendment.
  await db.exec(`UPDATE "Contract" SET "Total"=3100 WHERE "Contract_Number"=1;`);
  await db.exec(`UPDATE "Contract" SET billboard_ids='1,2,3,4' WHERE "Contract_Number"=1;`);
  assert.deepEqual((await tasks()).map(t=>t.amendment_number),[null,1,1,3]);
  await db.exec(`UPDATE "Contract" SET billboard_ids='1,2,3,4' WHERE "Contract_Number"=1;`);
  assert.equal((await items()).length,4);
  // Multiple additions in one transaction reuse the same amendment + team task.
  await db.exec(`BEGIN; UPDATE "Contract" SET billboard_ids='1,2,3,4,5' WHERE "Contract_Number"=1;
    UPDATE "Contract" SET "Total"=5000 WHERE "Contract_Number"=1; COMMIT;`);
  assert.equal((await tasks()).filter(t=>t.amendment_number===4).length,1);
  await db.exec(`BEGIN; UPDATE "Contract" SET billboard_ids='1,2,3,4' WHERE "Contract_Number"=1; ROLLBACK;`);
  assert.equal((await items()).length,5);
  // Removal cleans pending addendum work without reopening or removing the original completed task.
  await db.exec(`UPDATE "Contract" SET billboard_ids='1,3,4,5' WHERE "Contract_Number"=1;`);
  assert.equal((await items()).some(i=>Number(i.billboard_id)===2),false);
  assert.equal((await tasks()).find(t=>t.id===originalId).status,'completed');
  // No team still creates visible, unassigned pending work.
  await db.exec(`DELETE FROM installation_teams;
    INSERT INTO billboards("ID","Size","Faces_Count") VALUES(6,'9x9',2);
    UPDATE "Contract" SET billboard_ids='1,3,4,5,6' WHERE "Contract_Number"=1;`);
  assert.equal((await tasks()).some(t=>t.amendment_number===6 && t.team_id===null && t.status==='pending'),true);
  // Several additions in one save share a task; transaction rollback leaves no orphan work.
  await db.exec(`INSERT INTO billboards("ID","Size","Faces_Count") VALUES(7,'9x9',2),(8,'9x9',2);
    BEGIN; UPDATE "Contract" SET billboard_ids='1,3,4,5,6,7' WHERE "Contract_Number"=1;
    UPDATE "Contract" SET billboard_ids='1,3,4,5,6,7,8' WHERE "Contract_Number"=1; COMMIT;`);
  assert.equal((await tasks()).filter(t=>t.amendment_number===7).length,1);
  const lastItems=await items();
  assert.deepEqual(lastItems.filter(i=>i.amendment_number===7).map(i=>Number(i.billboard_id)),[7,8]);
  await db.exec(`INSERT INTO billboards("ID","Size","Faces_Count") VALUES(9,'9x9',2);
    BEGIN; UPDATE "Contract" SET billboard_ids='1,3,4,5,6,7,8,9' WHERE "Contract_Number"=1; ROLLBACK;`);
  assert.equal((await items()).some(i=>Number(i.billboard_id)===9),false);
  assert.equal((await tasks()).some(t=>t.amendment_number===8),false);
  console.log('Amendment installation task integration checks passed');
} finally { await db.close(); }
