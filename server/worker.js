import {checkPassword,signedIn,sessionCookie,clearCookie} from './auth.js';
const interests=['Everything New Vector AI','Kolloq','Emerra','SecureWhisper','AI education'];
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const validEmail=v=>typeof v==='string'&&v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)&&!/[\r\n]/.test(v);
function db(env){if(!env.DB)throw Error('Storage unavailable');return env.DB;}
async function getSettings(env){const {results}=await db(env).prepare('SELECT key,value FROM settings').all();return Object.fromEntries(results.map(r=>[r.key,r.value]));}
async function key(env){if(!env.SETTINGS_KEY)throw Error('Settings encryption unavailable');return crypto.subtle.importKey('raw',Uint8Array.from(atob(env.SETTINGS_KEY),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function encrypt(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv,...data));}
async function decrypt(value,env){const b=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},await key(env),b.slice(12)));}
async function notify(env,signup){try{const s=await getSettings(env);if(!s.recipient||!s.sender||!s.api_key)return 'not_configured';const result=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Authorization':`Bearer ${await decrypt(s.api_key,env)}`,'Content-Type':'application/json','Idempotency-Key':`nva-signup-${signup.id}`},body:JSON.stringify({from:s.sender,to:[s.recipient],subject:`New Vector AI waitlist: ${signup.interest}`,text:`New waitlist signup\n\nEmail: ${signup.email}\nInterest: ${signup.interest}\nDate: ${signup.created_at}`})});return result.ok?'sent':'failed';}catch{return 'failed';}}
async function asset(path,request,env){const assetUrl=new URL(request.url);assetUrl.pathname=path;const response=await env.ASSETS.fetch(new Request(assetUrl,{method:request.method}));const h=new Headers(response.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");return new Response(response.body,{status:response.status,headers:h});}
async function body(request){if(!request.headers.get('content-type')?.includes('application/json'))throw Error('Invalid request');const reader=request.body?.getReader();if(!reader)throw Error('Invalid request');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('Request too large');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}
const worker = {async fetch(request,env,ctx){const url=new URL(request.url),path=url.pathname;const admin=path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/admin/');
try{
 if(!['GET','HEAD','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method==='POST'){if(request.headers.get('origin')!==url.origin&&!(path==='/api/waitlist'&&publicOrigins.has(request.headers.get('origin'))))return json({error:'Request origin not allowed'},403);}
 if(url.hostname==='newvectorai.net'){url.hostname='www.newvectorai.net';return Response.redirect(url.toString(),308);}
 if(url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname)){url.protocol='https:';return Response.redirect(url.toString(),308);}
 if(path==='/api/auth/login'&&request.method==='POST'){
  let b;try{b=await body(request);}catch{return json({error:'Invalid sign-in request.'},400);}
  const now=Date.now();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('login:'+request.headers.get('cf-connecting-ip')+':'+Math.floor(now/3600000)));const bucket='auth:'+Buffer.from(digest).toString('hex');
  const rate=await db(env).prepare('INSERT INTO rate_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+3600000).first();
  ctx.waitUntil(db(env).prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run().catch(()=>{}));
  if(rate.count>10)return json({error:'Too many sign-in attempts. Try again in an hour.'},429);
  if(!await checkPassword(b.password,env))return json({error:'Incorrect password.'},401);
  return Response.json({ok:true},{headers:{...headers,'Set-Cookie':await sessionCookie(env)}});
 }
 if(path==='/api/auth/logout'&&request.method==='POST')return Response.json({ok:true},{headers:{...headers,'Set-Cookie':clearCookie}});
 const loginAsset=['/admin/login','/admin/login/','/admin/login/index.html','/admin/login.js'].includes(path);
 if(admin&&!loginAsset&&!await signedIn(request,env)){if(path.startsWith('/api/'))return json({error:'Sign in to manage your waitlist.'},401);return new Response(null,{status:302,headers:{...headers,Location:'/admin/login/'}});}
 if(path==='/api/waitlist'&&request.method==='POST'){
  let b;try{b=await body(request);}catch{return json({error:'Please check your form and try again.'},400);}
  if(b.website)return json({ok:true});if(!validEmail(b.email)||!interests.includes(b.interest)||b.consent!==true)return json({error:'Enter a valid email, choose an interest, and confirm your consent.'},400);
  const now=Date.now(),ip=request.headers.get('cf-connecting-ip')||'unknown';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${ip}:${Math.floor(now/3600000)}`));const bucket=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const rate=await db(env).prepare('INSERT INTO rate_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+3600000).first();if(rate.count>10)return json({error:'Too many requests. Please try again in an hour.'},429);
  const signup={id:crypto.randomUUID(),email:b.email.trim().toLowerCase(),interest:b.interest,created_at:new Date().toISOString()};const result=await db(env).prepare('INSERT INTO signups (id,email,interest,created_at,notification) VALUES (?,?,?,?,?) ON CONFLICT(email,interest) DO NOTHING').bind(signup.id,signup.email,signup.interest,signup.created_at,'pending').run();
  if(result.meta.changes){ctx.waitUntil((async()=>{const state=await notify(env,signup);await db(env).prepare('UPDATE signups SET notification=? WHERE id=?').bind(state,signup.id).run();})().catch(()=>console.error(JSON.stringify({event:'notification_status_failed'}))));}
  ctx.waitUntil(db(env).prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run().catch(()=>{}));return json({ok:true});
 }
 if(path==='/api/admin/settings'&&request.method==='GET'){const s=await getSettings(env);return json({recipient:s.recipient||'',sender:s.sender||'',emailConnected:!!s.api_key});}
 if(path==='/api/admin/settings'&&request.method==='POST'){let b;try{b=await body(request);}catch{return json({error:'Invalid settings.'},400);}if(!validEmail(b.recipient)||(b.sender&&!validEmail(b.sender))||(b.apiKey&&(typeof b.apiKey!=='string'||!/^re_[A-Za-z0-9_-]{8,200}$/.test(b.apiKey))))return json({error:'Enter valid email addresses and a valid Resend API key.'},400);const values=[['recipient',b.recipient.trim()],['sender',(b.sender||'').trim()]];if(b.apiKey)values.push(['api_key',await encrypt(b.apiKey,env)]);await db(env).batch(values.map(([k,v])=>db(env).prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,v)));return json({ok:true});}
 if(path==='/api/admin/signups'&&request.method==='GET'){const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0)return json({error:'Invalid page.'},400);const {results}=await db(env).prepare('SELECT id,email,interest,created_at,notification FROM signups ORDER BY created_at DESC LIMIT 100 OFFSET ?').bind(offset).all();const total=await db(env).prepare('SELECT count(*) AS count FROM signups').first();return json({signups:results,total:total.count});}
 if(path==='/api/admin/export'&&request.method==='GET'){const {results}=await db(env).prepare('SELECT email,interest,created_at,notification FROM signups ORDER BY created_at DESC LIMIT 10000').all();const cell=value=>'"'+String(value).replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';return new Response(['Email,Interest,Joined,Notification',...results.map(r=>[r.email,r.interest,r.created_at,r.notification].map(cell).join(','))].join('\r\n'),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="new-vector-waitlist.csv"'}});}
 if(path.startsWith('/api/'))return json({error:'Not found'},404);if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed'},405);
 const route=path==='/'?'/index.html':path==='/about'||path==='/about/'?'/about/index.html':path==='/admin/login'||path==='/admin/login/'?'/admin/login/index.html':path==='/kolloq'||path==='/kolloq/'?'/kolloq/index.html':path==='/admin'||path==='/admin/'?'/admin/index.html':path==='/securewhisper'||path==='/securewhisper/'?'/securewhisper/index.html':path==='/emerra'||path==='/emerra/'?'/emerra/index.html':path==='/privacy'||path==='/privacy/'?'/privacy/index.html':path==='/readme'||path==='/readme/'?'/readme/index.html':path;
 const response=await asset(route,request,env);if(request.method==='HEAD')return new Response(null,{status:response.status,headers:response.headers});return response;
}catch{console.error(JSON.stringify({event:'request_failed',path}));return json({error:'Temporarily unavailable. Please try again shortly.'},503);}}};

const publicOrigins=new Set(['https://www.newvectorai.net','https://newvectorai.net']);
export default {async fetch(request,env,ctx){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(url.hostname==='manage.newvectorai.net'&&url.pathname==='/')return Response.redirect('https://www.newvectorai.net/',302);
 if(url.pathname==='/api/waitlist'){
  const permitted=publicOrigins.has(origin);
  const cors=permitted?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:permitted?204:403,headers:{...headers,...cors}});
  const response=await worker.fetch(request,env,ctx);const h=new Headers(response.headers);for(const [k,v] of Object.entries(cors))h.set(k,v);
  return new Response(response.body,{status:response.status,headers:h});
 }
 return worker.fetch(request,env,ctx);
}};
