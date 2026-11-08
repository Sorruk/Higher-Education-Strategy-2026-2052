import { env } from 'cloudflare:workers';
import { identity,db,json,fail,ApiError } from '@/lib/server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try {
 await identity();const {id}=await params;const doc=await db().prepare('SELECT * FROM documents WHERE id=?').bind(id).first<{storage_key:string,filename:string}>();
 if(!doc?.storage_key)throw new ApiError(404,'NOT_FOUND');const object=await env.BUCKET?.get(doc.storage_key);if(!object)throw new ApiError(404,'NOT_FOUND');
 return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return fail(e);}}
