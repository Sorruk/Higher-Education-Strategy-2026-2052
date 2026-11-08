import { z } from 'zod';
import { statuses,areas,roles } from '@/lib/domain';
import { identity,db,bootstrap,writeAccess,checkOrigin,json,fail,ApiError,createRow,updateRow,now,auditStatement } from '@/lib/server';
export const dynamic='force-dynamic';
const id=z.string().min(1).max(160);
const nullableId=id.nullable();
const short=z.string().trim().min(1).max(1000);
const long=z.string().max(20000);
const year=z.number().int().min(2026).max(2052);
const date=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v).nullable();
const actionSchema=z.object({title_ru:short,title_tm:short,area:z.enum(areas),owner_text:z.string().max(2000),organization_id:nullableId,year,due_date:date,deadline_text:long,expected:long,status:z.enum(statuses),progress:z.number().int().min(0).max(100).nullable(),priority:z.enum(['normal','high']),notes:long,source_id:nullableId,source_locator:z.string().max(300),verification:z.enum(['draft','verified']),evidence_id:nullableId,archived:z.number().int().min(0).max(1)}).superRefine((v,c)=>{
 if(v.status==='completed' && (v.progress!==100 || !v.evidence_id))c.addIssue({code:'custom',message:'Completion requires 100% and an evidence document'});
 if(v.status==='unknown' && v.progress!==null)c.addIssue({code:'custom',message:'Unknown status must not have progress'});
 if(v.due_date && !v.due_date.startsWith(String(v.year)))c.addIssue({code:'custom',message:'Deadline must belong to selected year'});
});
async function reference(table:string,value:string|null|undefined) { if(value && !await db().prepare(`SELECT id FROM ${table} WHERE id=?`).bind(value).first())throw new ApiError(400,'INVALID_REFERENCE'); }
export async function GET() {try {
 const user=await identity();const tables=['actions','indicators','targets','observations','organizations','documents','reports','directions'];
 const out:Record<string,unknown>={user};
 await Promise.all(tables.map(async t=>{out[t]=(await db().prepare(`SELECT * FROM ${t} ${['actions','indicators'].includes(t)?'ORDER BY number':t==='directions'?'ORDER BY position':'ORDER BY rowid'}`).all()).results;}));
 out.audit=(await db().prepare('SELECT * FROM audit ORDER BY created_at DESC LIMIT 250').all()).results;
 out.members=user.role==='admin'?(await db().prepare('SELECT * FROM members ORDER BY name').all()).results:[];
 out.generated_at=now();return json(out);
 }catch(e){return fail(e);}}
export async function POST(request:Request) {try {
 checkOrigin(request);if(Number(request.headers.get('content-length')||0)>200000)throw new ApiError(413,'TOO_LARGE');
 const b=z.object({type:z.string(),id:id.optional(),version:z.number().int().positive().optional(),data:z.unknown().optional(),targets:z.unknown().optional()}).passthrough().parse(await request.json());
 if(b.type==='initialize'){await bootstrap();return json({ok:true});}
 const user=await identity();writeAccess(user);
 if(b.type==='action') {
  const data=actionSchema.parse(b.data);
  await reference('organizations',data.organization_id);await reference('documents',data.source_id);await reference('documents',data.evidence_id);
  if(data.verification==='verified'){const prior=b.id?await db().prepare('SELECT verification,title_ru,title_tm,expected,source_id,source_locator FROM actions WHERE id=?').bind(b.id).first<Record<string,unknown>>():null;if(!prior || prior.verification!=='verified' || ['title_ru','title_tm','expected','source_id','source_locator'].some(k=>prior[k]!==data[k as keyof typeof data]))writeAccess(user,true);}
  if(b.id)await updateRow('actions',id.parse(b.id),z.number().int().positive().parse(b.version),{...data,updated_at:now()},user.email);
  else {const n=await db().prepare('SELECT MAX(number) AS n FROM actions').first<{n:number}>(); await createRow('actions',{...data,id:crypto.randomUUID(),number:(n?.n||0)+1,version:1,updated_at:now()},user.email);}
 } else if(b.type==='organization') {
  const data=z.object({name_ru:short,name_tm:short,type:z.enum(['university','ministry','department','partner']),notes:long}).parse(b.data);
  if(b.id)await updateRow('organizations',id.parse(b.id),z.number().int().positive().parse(b.version),data,user.email);
  else await createRow('organizations',{...data,id:crypto.randomUUID(),version:1},user.email);
 } else if(b.type==='observation') {
  const data=z.object({indicator_id:id,year,scope:z.string().min(1).max(160),value:z.number().finite().min(0).max(1e14),evidence_id:id,notes:short}).parse(b.data);
  const metric=await db().prepare('SELECT * FROM indicators WHERE id=?').bind(data.indicator_id).first<{unit_type:string}>();if(!metric)throw new ApiError(404,'NOT_FOUND');
  if(metric.unit_type==='percent'&&data.value>100)throw new ApiError(400,'PERCENT_RANGE');
  if(metric.unit_type==='count'&&!Number.isInteger(data.value))throw new ApiError(400,'INTEGER_REQUIRED');
  if(data.scope!=='national')await reference('organizations',data.scope);
  await reference('documents',data.evidence_id);
  const existing=await db().prepare('SELECT id,version FROM observations WHERE indicator_id=? AND year=? AND scope=?').bind(data.indicator_id,data.year,data.scope).first<{id:string,version:number}>();
  if(existing){if(existing.id!==b.id)throw new ApiError(409,'VERSION_CONFLICT');await updateRow('observations',existing.id,z.number().int().positive().parse(b.version),{...data,updated_at:now(),updated_by:user.email},user.email);}
  else {if(b.id)throw new ApiError(409,'VERSION_CONFLICT');await createRow('observations',{...data,id:crypto.randomUUID(),version:1,updated_at:now(),updated_by:user.email},user.email);}
 } else if(b.type==='indicator') {
  writeAccess(user,true);
  const data=z.object({title_ru:short,title_tm:short,unit:short,unit_type:z.enum(['percent','count','money']),source_id:nullableId,source_locator:z.string().max(300),verification:z.enum(['draft','verified']),notes:long}).parse(b.data);
  await reference('documents',data.source_id);
  const vals=z.array(z.object({year,value:z.string().min(1).max(80)})).min(1).max(27).parse(b.targets);
  if(new Set(vals.map(t=>t.year)).size!==vals.length)throw new ApiError(400,'DUPLICATE_YEAR');
  const metricId=b.id?id.parse(b.id):crypto.randomUUID();
  const prior=b.id?await db().prepare('SELECT * FROM indicators WHERE id=?').bind(metricId).first<Record<string,unknown>>():null;
  if(b.id&&!prior)throw new ApiError(404,'NOT_FOUND');
  const priorTargets=(await db().prepare('SELECT year,value FROM targets WHERE indicator_id=?').bind(metricId).all()).results;
  const auditId=crypto.randomUUID();const statements:D1PreparedStatement[]=[];
  if(b.id){
   const version=z.number().int().positive().parse(b.version);const keys=Object.keys(data);
   statements.push(db().prepare(`UPDATE indicators SET ${keys.map(k=>`${k}=?`).join(',')},version=version+1 WHERE id=? AND version=?`).bind(...keys.map(k=>data[k as keyof typeof data]),metricId,version));
  }else{
   const n=await db().prepare('SELECT MAX(number) AS n FROM indicators').first<{n:number}>();const row={...data,id:metricId,number:(n?.n||0)+1,version:1};const keys=Object.keys(row);
   statements.push(db().prepare(`INSERT INTO indicators (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>row[k as keyof typeof row])));
  }
  statements.push(db().prepare('INSERT INTO audit (id,entity,entity_id,operation,before_json,after_json,actor,created_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(auditId,'indicators',metricId,b.id?'update':'create',JSON.stringify({indicator:prior,targets:priorTargets}),JSON.stringify({indicator:data,targets:vals}),user.email,now()));
  for(const target of vals)statements.push(db().prepare('INSERT INTO targets (id,indicator_id,year,value) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM audit WHERE id=?) ON CONFLICT(indicator_id,year) DO UPDATE SET value=excluded.value').bind(`${metricId}-${target.year}`,metricId,target.year,target.value,auditId));
  const result=await db().batch(statements);if(!result[0].meta.changes)throw new ApiError(409,'VERSION_CONFLICT');
 } else if(b.type==='report') {
  const data=z.object({title:short,action_id:nullableId,organization_id:nullableId,period:z.string().regex(/^20\d{2}-(H1|H2|Y)$/),body:z.string().min(10).max(20000),evidence_id:nullableId,status:z.enum(['draft','submitted'])}).parse(b.data);
  await reference('actions',data.action_id);await reference('organizations',data.organization_id);await reference('documents',data.evidence_id);
  if(data.status==='submitted'&&!data.evidence_id)throw new ApiError(400,'EVIDENCE_REQUIRED');
  if(b.id){const prior=await db().prepare('SELECT * FROM reports WHERE id=?').bind(id.parse(b.id)).first<{author:string,status:string}>();if(!prior)throw new ApiError(404,'NOT_FOUND');if(prior.author!==user.email)throw new ApiError(403,'FORBIDDEN');if(!['draft','returned'].includes(prior.status))throw new ApiError(409,'REPORT_LOCKED');await updateRow('reports',b.id,z.number().int().positive().parse(b.version),{...data,updated_at:now()},user.email);}
  else await createRow('reports',{...data,id:crypto.randomUUID(),author:user.email,reviewer:null,review_note:'',version:1,updated_at:now()},user.email);
 } else if(b.type==='review') {
  writeAccess(user,true);const data=z.object({id,version:z.number().int().positive(),status:z.enum(['accepted','returned']),review_note:z.string().min(3).max(10000)}).parse(b);
  const report=await db().prepare('SELECT * FROM reports WHERE id=?').bind(data.id).first<{status:string}>();if(report?.status!=='submitted')throw new ApiError(409,'REPORT_LOCKED');
  await updateRow('reports',data.id,data.version,{status:data.status,review_note:data.review_note,reviewer:user.email,updated_at:now()},user.email);
 } else if(b.type==='member') {
  writeAccess(user,true);const data=z.object({email:z.string().email().transform(s=>s.toLowerCase()),name:short,role:z.enum(roles)}).parse(b.data);
  if(data.email===user.email)throw new ApiError(400,'SELF_ROLE_CHANGE');
  const owner=await db().prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>();if(data.email===owner?.value)throw new ApiError(400,'OWNER_ROLE_CHANGE');
  const before=await db().prepare('SELECT * FROM members WHERE email=?').bind(data.email).first();
  await db().batch([db().prepare('INSERT INTO members (email,name,role,updated_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,updated_at=excluded.updated_at').bind(data.email,data.name,data.role,now()),auditStatement('members',data.email,'update',before,data,user.email)]);
 } else if(b.type==='direction') {
  const data=z.object({status:z.enum(statuses),action_id:nullableId,notes:long,text_ru:z.string().max(4000),source_id:nullableId,source_locator:z.string().max(300),verification:z.enum(['draft','verified'])}).parse(b.data);
  await reference('actions',data.action_id);await reference('documents',data.source_id);
  if(data.verification==='verified')writeAccess(user,true);
  await updateRow('directions',id.parse(b.id),z.number().int().positive().parse(b.version),{...data,updated_at:now()},user.email);
 } else throw new ApiError(400,'UNKNOWN_OPERATION');
 return json({ok:true});
 }catch(e){return fail(e);}}
