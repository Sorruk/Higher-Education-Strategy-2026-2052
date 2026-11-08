import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import seedInput from './seed.json';
const seed=seedInput as {documents:Record<string,any>[];actions:Record<string,any>[];indicators:Record<string,any>[];targets:Record<string,any>[];organizations:Record<string,any>[];directions?:Record<string,any>[]};
export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }
export const db = () => { if (!env.DB) throw new ApiError(503, 'DATABASE_UNAVAILABLE'); return env.DB; };
export const now = () => new Date().toISOString();
export async function identity() {
 const user = await getChatGPTUser(); if (!user) throw new ApiError(401, 'SIGN_IN_REQUIRED');
 const member = await db().prepare('SELECT role FROM members WHERE email = ?').bind(user.email.toLowerCase()).first<{role: string}>();
 return { ...user, email: user.email.toLowerCase(), role: member?.role || 'viewer' };
}
export function writeAccess(user: { role: string }, admin = false) { if (user.role === 'viewer' || (admin && user.role !== 'admin')) throw new ApiError(403, 'FORBIDDEN'); }
export function checkOrigin(request: Request) {
 const origin = request.headers.get('origin');
 if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'ORIGIN_MISMATCH');
 if (request.headers.get('sec-fetch-site') === 'cross-site') throw new ApiError(403, 'ORIGIN_MISMATCH');
}
export function json(value: unknown, status = 200) { return Response.json(value, {status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
export function fail(error: unknown) {
 if (error instanceof SyntaxError) return json({error:'INVALID_INPUT'},400);
 if (error instanceof ApiError) return json({error:error.code},error.status);
 if (error && typeof error === 'object' && 'issues' in error) return json({error:'INVALID_INPUT',issues:(error as {issues:unknown}).issues},400);
 console.error('Strategy API:',error instanceof Error ? error.message : 'unknown error');
 return json({error:'SERVER_ERROR'},500);
}
export function insert(table: string, row: Record<string, unknown>, ignore = false) {
 const keys = Object.keys(row);
 return db().prepare(`INSERT ${ignore?'OR IGNORE ':''}INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>row[k] == null ? null : row[k]));
}
export function auditStatement(entity:string,id:string,operation:string,before:unknown,after:unknown,actor:string,conditional=false) {
 const values=[crypto.randomUUID(),entity,id,operation,before?JSON.stringify(before):null,after?JSON.stringify(after):null,actor,now()];
 return db().prepare(`INSERT INTO audit (id,entity,entity_id,operation,before_json,after_json,actor,created_at) SELECT ?,?,?,?,?,?,?,? ${conditional?'WHERE changes() = 1':''}`).bind(...values);
}
export async function createRow(table:string,row:Record<string,unknown>,actor:string) { await db().batch([insert(table,row),auditStatement(table,String(row.id),'create',null,row,actor)]); }
export async function updateRow(table:string,id:string,version:number,changes:Record<string,unknown>,actor:string) {
 const before = await db().prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<Record<string,unknown>>();
 if (!before) throw new ApiError(404,'NOT_FOUND');
 const next={...changes,version:version+1};const keys=Object.keys(next);
 const r=await db().batch([db().prepare(`UPDATE ${table} SET ${keys.map(k=>`${k} = ?`).join(',')} WHERE id = ? AND version = ?`).bind(...keys.map(k=>next[k as keyof typeof next] ?? null),id,version),auditStatement(table,id,'update',before,{...before,...next},actor,true)]);
 if (!r[0].meta.changes) throw new ApiError(409,'VERSION_CONFLICT');
}
export async function bootstrap() {
 const user=await getChatGPTUser();if(!user)throw new ApiError(401,'SIGN_IN_REQUIRED');
 const database=db();
 // First authenticated visitor can initialize only behind the owner-private Sites gate.
 await database.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('owner', ?)").bind(user.email.toLowerCase()).run();
 const owner=await database.prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>();
 await insert('members',{email:user.email.toLowerCase(),name:user.displayName,role:owner?.value===user.email.toLowerCase()?'admin':'viewer',updated_at:now()},true).run();
 if(await database.prepare("SELECT value FROM settings WHERE key='seeded'").first())return;
 if(owner?.value!==user.email.toLowerCase())throw new ApiError(403,'INITIALIZATION_PENDING');
 for(const [table,rows] of Object.entries(seed)) {
  for(let i=0;i<rows.length;i+=40) {
   await database.batch(rows.slice(i,i+40).map(row=>insert(table,{...row,...(table==='documents'?{created_at:now()}:['actions','directions'].includes(table)?{updated_at:now()}:{})},true)));
  }
 }
 await database.batch([database.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('seeded','1')"),auditStatement('system','seed','initialize',null,{actions:seed.actions.length,indicators:seed.indicators.length,directions:seed.directions?.length||0,source:'draft-documents'},user.email)]);
}
