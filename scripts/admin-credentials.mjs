import {mkdir,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {passwordHash} from '../server/auth.js';
await mkdir('.local',{recursive:true,mode:0o700});
const target='.local/cloudflare-secrets.json';
try {await access(target);console.error('Credentials already exist. Move the existing file to a safe backup before rotating.');process.exit(1);} catch(error){if(error.code!=='ENOENT')throw error;}
const password=randomBytes(32).toString('base64url');
const salt=randomBytes(32).toString('base64url');
const secrets={ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:await passwordHash(password,salt),SESSION_SECRET:randomBytes(32).toString('base64url'),SETTINGS_KEY:randomBytes(32).toString('base64')};
await writeFile(target,JSON.stringify(secrets,null,2),{mode:0o600});
await writeFile('.local/admin-access.txt',`New Vector AI owner access\n\nURL: https://newvectorai.net/admin/\nPassword: ${password}\n\nKeep this password in your password manager. No username is needed.\nThis file is ignored by Git and readable only by your local account.\n`,{mode:0o600});
console.log('Created credentials in .local/admin-access.txt and deployment secrets in .local/cloudflare-secrets.json.');
