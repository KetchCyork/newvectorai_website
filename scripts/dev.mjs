import {createServer} from 'node:http';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {localDB} from './local-db.mjs';
import worker from '../server/worker.js';
await mkdir('.local',{recursive:true});
const DB=localDB('.local/waitlist.sqlite');
DB.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){
 if(!await DB.prepare('SELECT name FROM local_migrations WHERE name=?').bind(f).first()){
  DB.exec(await readFile(`drizzle/${f}`,'utf8'));
  await DB.prepare('INSERT INTO local_migrations(name) VALUES (?)').bind(f).run();
 }
}
const secrets=JSON.parse(await readFile('.local/cloudflare-secrets.json','utf8'));
const root=resolve('public');
const ASSETS={async fetch(request){
 const file=resolve(root,'.'+new URL(request.url).pathname);
 if(!file.startsWith(root+sep))return new Response('Not found',{status:404});
 try {const bytes=await readFile(file);const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png',svg:'image/svg+xml',xml:'application/xml',txt:'text/plain'};return new Response(bytes,{headers:{'Content-Type':types[file.split('.').pop()]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}};
const env={DB,ASSETS,...secrets};
createServer(async(req,res)=>{try{
 const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>8192){res.writeHead(413);res.end();return;}chunks.push(c);}
 const request=new Request(`http://localhost:4173${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 const response=await worker.fetch(request,env,{waitUntil:p=>p.catch(()=>{})});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Preview unavailable');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://localhost:4173 — owner password in .local/admin-access.txt'));
