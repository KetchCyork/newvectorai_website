import {readFile,writeFile,mkdir,rm,cp,readdir} from 'node:fs/promises';
const assets={};
async function collect(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${entry.name}`,url=`${prefix}/${entry.name}`;if(entry.isDirectory())await collect(path,url);else assets[url]=(await readFile(path)).toString('base64');}}
await collect('public');
const worker=await readFile('server/worker.js','utf8');
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',`const ASSET_DATA=${JSON.stringify(assets)};\n${worker.replace("import { ASSET_DATA } from './assets.js';",'')}`);
await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker with',Object.keys(assets).length,'assets and database migrations.');
