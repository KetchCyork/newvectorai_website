import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
const encode = value => new TextEncoder().encode(value);
const cookieName = '__Host-nva_admin';
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
  return Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encode(salt),iterations:100000},key,256)).toString('base64');
}
export async function checkPassword(password, env) {
  if (typeof password !== 'string' || password.length > 256 || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT) return false;
  const actual = Buffer.from(await passwordHash(password, env.ADMIN_PASSWORD_SALT),'base64');
  const expected = Buffer.from(env.ADMIN_PASSWORD_HASH,'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function signedIn(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if (!token) return false;
  try { const {payload} = await jwtVerify(token,encode(env.SESSION_SECRET),{algorithms:['HS256'],issuer:'newvectorai',audience:'admin'}); return payload.sub === 'owner'; } catch { return false; }
}
export async function sessionCookie(env) {
  if (!env.SESSION_SECRET) throw Error('Admin authentication unavailable');
  const token=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject('owner').setIssuer('newvectorai').setAudience('admin').setIssuedAt().setExpirationTime('1h').sign(encode(env.SESSION_SECRET));
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`;
}
export const clearCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
