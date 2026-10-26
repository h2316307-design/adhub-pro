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
    const addedColumns = name === 'Contract' ? ['edit_revision']
      : name === 'paused_billboards' ? ['price_snapshot', 'lifecycle_state', 'resumed_at'] : [];
    const definitions = row.members.filter(m => !addedColumns.includes(m.name.getText(source).replaceAll('"', ''))).map(m => {
      const field = m.name.getText(source).replaceAll('"', '');
      const type = m.type.getText(source);
      let sqlType = /\bnumber\b/.test(type) ? 'numeric' : /\bboolean\b/.test(type) ? 'boolean' : /Json|\[\]/.test(type) ? 'jsonb' : 'text';
      if (['id','task_id','user_id','paused_billboard_id','friend_company_id'].includes(field) && sqlType === 'text') sqlType = 'uuid';
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
  const p=id=>({billboardId:String(id),finalPrice:3000,basePriceBeforeDiscount:3000,startDate:'2026-10-01',endDate:'2026-10-30'});
  await db.query(`INSERT INTO "Contract"("Contract_Number","Customer Name","Contract Date","End Date",billboard_ids,billboard_prices,"Total","Total Rent","Total Paid")
    VALUES(1,'Original customer','2026-10-01','2026-10-30','1,2',$1,6000,6000,'0')`,[JSON.stringify([p(1),p(2)])]);
  await db.exec(`INSERT INTO billboards("ID","Billboard_Name","Contract_Number","Size",size_id) VALUES(1,'Original board',1,'3x4',1),(2,'Second board',1,'3x4',1),(3,'Added board',NULL,'3x4',1);
    INSERT INTO contract_terms(id,term_title,term_content,term_order,is_active) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Original term','Original terms',1,true);
    INSERT INTO installation_tasks(id,contract_id,status) VALUES('11111111-1111-1111-1111-111111111111',1,'pending');
    INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('11111111-1111-1111-1111-111111111111',1,'completed'),('11111111-1111-1111-1111-111111111111',2,'pending');`);
  const status=async()=>(await db.query('SELECT contract_amendment_status(1) value')).rows[0].value;
  assert.equal((await status()).enabled,false);
  await db.exec(`UPDATE "Contract" SET "Ad Type"='Before installation' WHERE "Contract_Number"=1`);
  assert.equal((await db.query('SELECT * FROM contract_amendments')).rows.length,0);
  await db.exec(`UPDATE installation_task_items SET status='completed' WHERE billboard_id=2`);
  assert.equal((await status()).enabled,true);
  // First amendment preserves the exact original contract and board metadata.
  await db.exec(`UPDATE "Contract" SET "Customer Name"='Amended customer' WHERE "Contract_Number"=1`);
  let docs=(await db.query('SELECT * FROM contract_amendments ORDER BY amendment_number')).rows;
  assert.deepEqual(docs.map(d=>d.amendment_number),[0,1]);
  const original=docs[0].snapshot;
  assert.equal(original['Customer Name'],'Original customer');
  assert.equal(docs[1].snapshot['Customer Name'],'Amended customer');
  assert.equal(original._snapshot_billboards[0].Billboard_Name,'Original board');
  assert.equal(original._snapshot_terms[0].term_content,'Original terms');
  // Add a new pending board; later edits must remain numbered.
  await db.query(`UPDATE "Contract" SET billboard_ids='1,2,3',billboards_count=3,billboard_prices=$1,"Total"=9000 WHERE "Contract_Number"=1`,[JSON.stringify([p(1),p(2),p(3)])]);
  await db.exec(`INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('11111111-1111-1111-1111-111111111111',3,'pending')`);
  assert.equal((await status()).fullyInstalled,false); assert.equal((await status()).enabled,true);
  await db.exec(`UPDATE "Contract" SET "Ad Type"='After addition' WHERE "Contract_Number"=1`);
  assert.equal((await status()).latestNumber,3);
  // Repeated no-op save and payments are not new business amendments.
  await db.exec(`UPDATE "Contract" SET "Ad Type"='After addition' WHERE "Contract_Number"=1`);
  await db.exec(`UPDATE "Contract" SET "Total Paid"='1000',"Remaining"='8000' WHERE "Contract_Number"=1`);
  assert.equal((await status()).latestNumber,3);
  // One transaction can contain multiple writes (pause + replacement); number it once.
  await db.exec(`BEGIN; UPDATE "Contract" SET "Total"=8500 WHERE "Contract_Number"=1; UPDATE "Contract" SET "Total"=8750 WHERE "Contract_Number"=1; COMMIT;`);
  assert.equal((await status()).latestNumber,4);
  docs=(await db.query('SELECT * FROM contract_amendments ORDER BY amendment_number')).rows;
  assert.equal(Number(docs[4].total_before),9000); assert.equal(Number(docs[4].total_after),8750);
  // Editing live catalog and terms cannot change historical documents.
  await db.exec(`UPDATE billboards SET "Billboard_Name"='Changed catalog' WHERE "ID"=1; UPDATE contract_terms SET term_content='Changed terms';`);
  assert.deepEqual((await db.query('SELECT snapshot FROM contract_amendments WHERE amendment_number=0')).rows[0].snapshot,original);
  // Rollback does not consume a number or leave an orphan document.
  await db.exec('BEGIN');
  await db.exec(`UPDATE "Contract" SET "Total"=9999 WHERE "Contract_Number"=1`);
  await db.exec('ROLLBACK');
  assert.equal((await status()).latestNumber,4);
  // Installed replacement updates the contract twice, but produces one final numbered snapshot.
  await db.exec(`INSERT INTO billboards("ID","Billboard_Name","Size",size_id) VALUES(4,'New replacement','3x4',1)`);
  const swap=(await db.query("SELECT replace_contract_billboard_lifecycle(1,1,4,NULL,'version-swap') result")).rows[0].result;
  assert.equal(swap.success,true); assert.equal((await status()).latestNumber,5);
  const swapDocument=(await db.query('SELECT snapshot FROM contract_amendments WHERE amendment_number=5')).rows[0].snapshot;
  assert.equal(swapDocument._snapshot_billboards.some(b=>Number(b.ID)===4),true);
  assert.equal(swapDocument._snapshot_billboards.some(b=>Number(b.ID)===1),false);
  assert.equal(swapDocument._snapshot_paused.some(p=>Number(p.billboard_id)===1),true);
  assert.deepEqual((await db.query('SELECT snapshot FROM contract_amendments WHERE amendment_number=0')).rows[0].snapshot,original);
  // Client role can read through the contract policy, but cannot alter history.
  await db.exec('GRANT SELECT ON "Contract" TO authenticated; SET ROLE authenticated;');
  assert.equal((await db.query('SELECT * FROM contract_amendments')).rows.length,6);
  await assert.rejects(()=>db.exec('UPDATE contract_amendments SET amendment_number=99'),/permission denied/);
  await assert.rejects(()=>db.exec('DELETE FROM contract_amendments'),/permission denied/);
  await db.exec('RESET ROLE');
  await db.exec('ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY; CREATE POLICY hide_contracts ON public."Contract" FOR SELECT TO authenticated USING (false); SET ROLE authenticated;');
  assert.equal((await db.query('SELECT * FROM contract_amendments')).rows.length,0);
  await db.exec('RESET ROLE');
  console.log('Numbered amendment PostgreSQL checks passed: all-board eligibility, preserved original, serial revisions, pending additions, no-op and payment exclusion, transaction grouping, rollback, and read-only history.');
} catch(error) { console.error(error.message,error.where||'',error.internalQuery||''); process.exitCode=1; } finally { await db.close(); }
