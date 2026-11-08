import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:8787';
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(origin))throw Error('Integration test is local-only');
const admin='seedy@sites.test',viewer='qa-viewer@sites.test',editor='qa-editor@sites.test';
let passed=0;
async function req(body,user=admin,path='/api/strategy',headers={}){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':'local_'+user,'oai-authenticated-user-email':user}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
function check(name,got,status){assert.equal(got.status,status,`${name}: ${JSON.stringify(got.data)}`);passed++;console.log('PASS',name);return got.data;}
check('anonymous reads rejected',await req(null,null),401);
check('initialize is idempotent',await req({type:'initialize'}),200);
check('initialize is idempotent twice',await req({type:'initialize'}),200);
let snap=check('read seeded database',await req(),200);assert.ok(Array.isArray(snap.actions));assert.ok(Array.isArray(snap.indicators));
check('assign editor',await req({type:'member',data:{email:editor,name:'QA Editor',role:'editor'}}),200);
check('assign viewer',await req({type:'member',data:{email:viewer,name:'QA Viewer',role:'viewer'}}),200);
check('viewer mutation rejected',await req({type:'organization',data:{name_ru:'QA',name_tm:'QA',type:'partner',notes:''}},viewer),403);
check('editor cannot grant roles',await req({type:'member',data:{email:viewer,name:'QA Viewer',role:'admin'}},editor),403);
check('cross-origin writes rejected',await req({type:'initialize'},admin,'/api/strategy',{Origin:'https://unrelated.example'}),403);
// Fixture preparation also supports a fresh public checkout with empty seed data.
let evidenceId=snap.documents.find(d=>d.verification!=='unavailable')?.id;
if(!evidenceId){const fd=new FormData();fd.set('file',new Blob(['QA fixture']),'qa-fixture.txt');fd.set('title','QA fixture');const r=await fetch(origin+'/api/upload',{method:'POST',headers:{'oai-authenticated-user-id':'local_qa','oai-authenticated-user-email':admin},body:fd});evidenceId=(await r.json()).id;assert.ok(evidenceId);}
if(!snap.actions.length){check('prepare action fixture',await req({type:'action',data:{title_ru:'QA action',title_tm:'QA çäre',area:'governance',owner_text:'QA',organization_id:null,year:2026,due_date:'2026-12-31',deadline_text:'QA',expected:'QA',status:'unknown',progress:null,priority:'normal',notes:'',source_id:evidenceId,source_locator:'QA',verification:'draft',evidence_id:null,archived:0}}),200);}
if(!snap.indicators.length){check('prepare indicator fixture',await req({type:'indicator',data:{title_ru:'QA indicator',title_tm:'QA görkeziji',unit:'%',unit_type:'percent',source_id:evidenceId,source_locator:'QA',verification:'draft',notes:''},targets:[{year:2026,value:'17'}]}),200);}
snap=(await req()).data;const metricId=snap.indicators[0].id;const a=snap.actions[0];
check('completion requires evidence',await req({type:'action',id:a.id,version:a.version,data:{...a,status:'completed',progress:100,evidence_id:null}},editor),400);
check('update persists',await req({type:'action',id:a.id,version:a.version,data:{...a,status:'in_progress',progress:25,notes:'QA persistence'}},editor),200);
check('stale update rejected',await req({type:'action',id:a.id,version:a.version,data:{...a,status:'planned',progress:0}},editor),409);
snap=(await req()).data;assert.equal(snap.actions[0].progress,25);
check('restore initial action status',await req({type:'action',id:a.id,version:snap.actions[0].version,data:a}),200);
check('percent over 100 rejected',await req({type:'observation',data:{indicator_id:metricId,year:2026,scope:'national',value:101,evidence_id:evidenceId,notes:'QA invalid'}},editor),400);
check('missing evidence reference rejected',await req({type:'observation',data:{indicator_id:metricId,year:2026,scope:'national',value:10,evidence_id:'missing',notes:'QA invalid'}},editor),400);
check('zero fact persisted',await req({type:'observation',data:{indicator_id:metricId,year:2026,scope:'national',value:0,evidence_id:evidenceId,notes:'QA only'}},editor),200);
check('duplicate fact conflicts',await req({type:'observation',data:{indicator_id:metricId,year:2026,scope:'national',value:5,evidence_id:evidenceId,notes:'QA duplicate'}},editor),409);
const k=snap.indicators[0],targets=snap.targets.filter(t=>t.indicator_id===k.id).map(t=>({year:t.year,value:t.value}));
check('editor cannot alter approved targets',await req({type:'indicator',id:k.id,version:k.version,data:k,targets},editor),403);
check('atomic target update succeeds',await req({type:'indicator',id:k.id,version:k.version,data:k,targets}),200);
check('stale target update rejected',await req({type:'indicator',id:k.id,version:k.version,data:k,targets:targets.map(t=>({...t,value:'999'}))}),409);
assert.equal((await req()).data.targets.find(t=>t.indicator_id===metricId&&t.year===2026).value,'17');
const report={title:'QA temporary report',action_id:a.id,organization_id:null,period:'2026-H1',body:'QA test report body, not real execution',evidence_id:evidenceId,status:'submitted'};
check('submit report',await req({type:'report',data:report},editor),200);
snap=(await req()).data;let r=snap.reports.find(r=>r.title===report.title);
check('submitted report locked',await req({type:'report',id:r.id,version:r.version,data:report},editor),409);
check('editor cannot review',await req({type:'review',id:r.id,version:r.version,status:'accepted',review_note:'QA accepted'},editor),403);
check('return for revision',await req({type:'review',id:r.id,version:r.version,status:'returned',review_note:'QA revise'}),200);
r=(await req()).data.reports.find(x=>x.id===r.id);
check('author resubmits returned report',await req({type:'report',id:r.id,version:r.version,data:report},editor),200);
r=(await req()).data.reports.find(x=>x.id===r.id);
check('administrator accepts report',await req({type:'review',id:r.id,version:r.version,status:'accepted',review_note:'QA reviewed'}),200);
const form=new FormData();form.set('file',new Blob(['QA document payload']), 'qa-evidence.txt');form.set('title','QA evidence');
const upload=await fetch(origin+'/api/upload',{method:'POST',headers:{'oai-authenticated-user-id':'local_qa','oai-authenticated-user-email':editor},body:form});const uploaded=await upload.json();check('R2 file upload',{status:upload.status,data:uploaded},200);
const downloaded=await fetch(origin+'/api/files/'+uploaded.id,{headers:{'oai-authenticated-user-id':'local_qa','oai-authenticated-user-email':editor}});assert.equal(await downloaded.text(),'QA document payload');passed++;console.log('PASS R2 download exact bytes');
const latest=(await req()).data;assert.ok(latest.audit.some(x=>x.entity==='reports'&&x.entity_id===r.id));passed++;console.log('PASS audit trail');
console.log(`${passed} integration checks passed`);
