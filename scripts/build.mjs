import {rm, mkdir, cp} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist/client',{recursive:true});
console.log('Built static assets for Cloudflare Workers.');
