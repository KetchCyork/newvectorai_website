import {rm, mkdir, cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/client',{recursive:true});
await cp('backend/admin','dist/client/admin',{recursive:true});
for(const name of ['style.css','favicon.svg'])await cp('public/'+name,'dist/client/'+name);
console.log('Built protected administration assets for Cloudflare. Public website stays on GitHub Pages.');
