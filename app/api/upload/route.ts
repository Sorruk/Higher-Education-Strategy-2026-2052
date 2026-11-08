import { env } from 'cloudflare:workers';
import { identity,writeAccess,checkOrigin,createRow,now,json,fail,ApiError } from '@/lib/server';
export async function POST(request:Request){let key:string|undefined;try {
 checkOrigin(request);const user=await identity();writeAccess(user);
 if(Number(request.headers.get('content-length')||0)>21*1024*1024)throw new ApiError(413,'FILE_TOO_LARGE');
 const form=await request.formData();const file=form.get('file');
 if(!(file instanceof File)||!file.size||file.size>20*1024*1024)throw new ApiError(400,'INVALID_FILE');
 const ext=file.name.split('.').pop()?.toLowerCase()||'';
 if(!['pdf','doc','docx','xlsx','csv','txt','png','jpg','jpeg','m4a','mp3'].includes(ext))throw new ApiError(400,'FILE_TYPE');
 const title=String(form.get('title')||file.name).slice(0,1000);const id=crypto.randomUUID();key=`documents/${id}`;
 const bytes=await file.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(!env.BUCKET)throw new ApiError(503,'STORAGE_UNAVAILABLE');
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
 await createRow('documents',{id,title_ru:title,title_tm:String(form.get('title_tm')||title).slice(0,1000),filename:file.name.slice(0,250),kind:ext,verification:'uploaded',size:file.size,sha256:hash,parts:'[]',storage_key:key,notes:String(form.get('notes')||'').slice(0,5000),created_at:now()},user.email);
 return json({ok:true,id});
 }catch(e){if(key&&env.BUCKET)await env.BUCKET.delete(key).catch(()=>{});return fail(e);}}
