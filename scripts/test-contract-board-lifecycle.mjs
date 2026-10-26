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
  await db.exec("CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '11111111-1111-1111-1111-111111111111'::uuid$$;");
  const names = ['Contract','billboards','paused_billboards','paused_billboard_replacements','shared_billboards','friend_billboard_rentals','activity_log',
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
  const task='22222222-2222-2222-2222-222222222222';
  const price=(id,extras={})=>({billboardId:String(id),basePriceBeforeDiscount:3000,finalPrice:3500,printCost:300,installationCost:200,startDate:'2026-10-01',endDate:'2026-10-30',...extras});
  const contract=async(id,prices)=>{
    await db.query(`INSERT INTO public."Contract"("Contract_Number","Customer Name","Contract Date","End Date",billboard_ids,billboard_prices,"Total","Total Rent","Total Paid",print_cost_enabled,installation_enabled)
      VALUES($1,'Test','2026-10-01','2026-10-30',$2,$3,$4,$4,'0','true',true)`,[id,prices.map(p=>p.billboardId).join(','),JSON.stringify(prices),prices.reduce((s,p)=>s+p.finalPrice,0)]);
    for(const p of prices) await db.query(`INSERT INTO public.billboards("ID","Billboard_Name","Contract_Number","Size",size_id,"Rent_Start_Date","Rent_End_Date") VALUES($1,$2,$3,'3x4',1,'2026-10-01','2026-10-30')`,[Number(p.billboardId),`Board ${p.billboardId}`,id]);
  };
  const save=async(id,prices)=>{
    const c=(await db.query('SELECT edit_revision FROM public."Contract" WHERE "Contract_Number"=$1',[id])).rows[0];
    const total=prices.reduce((s,p)=>s+p.finalPrice,0);
    return db.query('SELECT public.save_contract_edit_atomic($1,$2::jsonb,$3::bigint)',[id,JSON.stringify({'Customer Name':'Test','Contract Date':'2026-10-01','End Date':'2026-10-30',billboard_ids:prices.map(p=>p.billboardId),billboard_prices:JSON.stringify(prices),Total:total,installments_data:[{amount:total,dueDate:'2026-10-01'}]}),c.edit_revision]);
  };
  await contract(1,[price(1),price(2)]);
  await db.query("INSERT INTO public.installation_tasks(id,contract_id,status,task_type) VALUES($1,1,'completed','installation')",[task]);
  await db.query("INSERT INTO public.installation_task_items(task_id,billboard_id,status) VALUES($1,1,'completed'),($1,2,'pending')",[task]);
  // Individual board status wins over an incorrectly completed parent order.
  assert.equal((await db.query('SELECT public.contract_board_is_installed(1,2) value')).rows[0].value,false);
  await save(1,[price(1)]);
  assert.equal((await db.query('SELECT * FROM installation_task_items WHERE billboard_id=2')).rows.length,0);
  await assert.rejects(()=>save(1,[]),/INSTALLED_BILLBOARD_REQUIRES_PAUSE/);
  // First-day pause: retain installation + enabled printing, refund rental only.
  const paused=(await db.query("SELECT public.pause_contract_billboard_atomic(1,1,'2026-10-01') result")).rows[0].result;
  assert.equal(paused.pauseRefund,3000);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),500);
  assert.equal((await db.query('SELECT replacement_status FROM installation_task_items WHERE billboard_id=1')).rows[0].replacement_status,'replaced');
  assert.equal((await db.query('SELECT price_snapshot FROM paused_billboards WHERE id=$1',[paused.pauseId])).rows[0].price_snapshot.retainExecutedServices,true);
  await db.query('SELECT public.edit_paused_billboard_atomic($1,$2::jsonb)',[paused.pauseId,JSON.stringify({manual_refund:0})]);
  assert.equal(Number((await db.query('SELECT "Total" value FROM public."Contract" WHERE "Contract_Number"=1')).rows[0].value),3500);
  // Addition after installation produces exactly one immutable addendum, including custom dates.
  await contract(2,[price(3)]);
  await db.exec(`INSERT INTO installation_tasks(id,contract_id,status) VALUES('33333333-3333-3333-3333-333333333333',2,'pending');
    INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('33333333-3333-3333-3333-333333333333',3,'completed');
    INSERT INTO billboards("ID","Billboard_Name","Size",size_id) VALUES(4,'Added','3x4',1);`);
  const added=[price(3),price(4,{startDate:'2026-10-26'})];
  await save(2,added); await save(2,added);
  const addenda=(await db.query("SELECT details FROM activity_log WHERE action='contract_addendum' AND contract_number=2")).rows;
  assert.equal(addenda.length,1); assert.equal(addenda[0].details.boards[0].startDate,'2026-10-26');
  // Installed swap is atomic, preserves total, and retries do not duplicate pauses.
  await db.exec(`INSERT INTO billboards("ID","Billboard_Name","Size",size_id) VALUES(5,'Replacement','3x4',1)`);
  const swap=()=>db.query("SELECT public.replace_contract_billboard_lifecycle(2,3,5,NULL,'test-request') result");
  const result=(await swap()).rows[0].result;
  assert.equal(result.success,true); assert.equal(Number(result.contract_total_after),7000);
  assert.equal((await swap()).rows[0].result.already_processed,true);
  assert.equal((await db.query('SELECT * FROM paused_billboards WHERE billboard_id=3')).rows.length,1);
  // A late failure rolls back pause and release as one transaction.
  await db.exec(`INSERT INTO billboards("ID","Billboard_Name","Size",size_id) VALUES(6,'Bad candidate','3x4',2)`);
  await db.exec(`INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('33333333-3333-3333-3333-333333333333',5,'completed');`);
  await assert.rejects(()=>db.query("SELECT public.replace_contract_billboard_lifecycle(2,5,6,NULL,'bad')"), /يجب اختيار/);

  await contract(3,[price(7)]);
  await db.exec(`UPDATE "Contract" SET print_cost_enabled='false' WHERE "Contract_Number"=3;
    INSERT INTO installation_tasks(id,contract_id,status) VALUES('77777777-7777-7777-7777-777777777777',3,'pending');
    INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('77777777-7777-7777-7777-777777777777',7,'completed');`);
  const disabled=(await db.query("SELECT public.pause_contract_billboard_atomic(3,7,'2026-10-01') result")).rows[0].result;
  assert.equal(disabled.pauseRefund,3300);
  assert.equal(Number((await db.query('SELECT "Total" value FROM "Contract" WHERE "Contract_Number"=3')).rows[0].value),200);
  await contract(4,[price(8)]);
  await db.exec(`INSERT INTO installation_tasks(id,contract_id,status) VALUES('88888888-8888-8888-8888-888888888888',4,'pending');
    INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('88888888-8888-8888-8888-888888888888',8,'pending');`);
  await save(4,[]);
  assert.equal((await db.query('SELECT * FROM installation_task_items WHERE billboard_id=8')).rows.length,0);
  assert.equal((await db.query("SELECT * FROM activity_log WHERE contract_number=4 AND action='contract_addendum'")).rows.length,0);
  // Force a failure after pause and candidate assignment; all writes must roll back.
  await db.exec(`INSERT INTO billboards("ID","Billboard_Name","Size",size_id) VALUES(9,'Rollback replacement','3x4',1);
    CREATE FUNCTION reject_swap_log() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.action='installed_board_swap' THEN RAISE EXCEPTION 'TEST_ROLLBACK'; END IF; RETURN NEW; END$$;
    CREATE TRIGGER reject_swap_log BEFORE INSERT ON activity_log FOR EACH ROW EXECUTE FUNCTION reject_swap_log();`);
  const before=(await db.query('SELECT "Total",billboard_ids FROM "Contract" WHERE "Contract_Number"=2')).rows[0];
  // Board 4 becomes installed; this must exercise pause, not the pending fallback.
  await db.exec(`INSERT INTO installation_task_items(task_id,billboard_id,status) VALUES('33333333-3333-3333-3333-333333333333',4,'completed');`);
  await assert.rejects(()=>db.query("SELECT public.replace_contract_billboard_lifecycle(2,4,9,NULL,'rollback')"),/TEST_ROLLBACK/);
  assert.deepEqual((await db.query('SELECT "Total",billboard_ids FROM "Contract" WHERE "Contract_Number"=2')).rows[0],before);
  assert.equal((await db.query('SELECT * FROM paused_billboards WHERE billboard_id=4')).rows.length,0);
  assert.equal((await db.query('SELECT "Contract_Number" FROM billboards WHERE "ID"=9')).rows[0].Contract_Number,null);
  console.log('Lifecycle PostgreSQL checks passed: pending removal, installed guard, services, zero refund edit, immutable addenda, swap and retry.');
} catch(error) { console.error(error.message,error.where||'',error.internalQuery||''); process.exitCode=1; } finally { await db.close(); }
