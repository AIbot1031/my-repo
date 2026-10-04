import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {database} from '@/db/storage';
export const ADMIN_COOKIE='drink-admin-session';
export const SESSION_SECONDS=8*60*60;
const bytes=(s:string)=>new Uint8Array(s.match(/../g)!.map(x=>parseInt(x,16)));
const hex=(b:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(b)).map(n=>n.toString(16).padStart(2,'0')).join('');
export const digest=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
function credential(){
 const value=(env as unknown as {ADMIN_PASSWORD_RECORD?:string}).ADMIN_PASSWORD_RECORD;
 if(!value)throw new Error('Admin credential unavailable');
 const r=JSON.parse(value) as {salt:string;hash:string;iterations:number};
 if(!/^[a-f0-9]{48}$/.test(r.salt)||!/^[a-f0-9]{64}$/.test(r.hash)||r.iterations!==100000)throw new Error('Invalid credential configuration');
 return {value,...r};
}
export async function verifyPassword(password:string){
 const r=credential();
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(r.salt),iterations:r.iterations},key,256));
 const expected=bytes(r.hash);let diff=0;for(let i=0;i<expected.length;i++)diff|=actual[i]^expected[i];return diff===0;
}
export function sessionFromCookie(cookie:string){return cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(ADMIN_COOKIE+'='))?.slice(ADMIN_COOKIE.length+1)||''}
export function adminCookie(token:string,url:string,maxAge=SESSION_SECONDS){return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(url).protocol==='https:'?'; Secure':''}`}
export async function adminAccess(){
 const h=await headers(),token=sessionFromCookie(h.get('cookie')||'');
 if(!/^[a-f0-9]{64}$/.test(token))return {user:null,allowed:false};
 try{
  const row=await database().prepare('SELECT expires,credential_version FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).first<{expires:number;credential_version:string}>();
  const allowed=!!row&&row.expires>Date.now()&&row.credential_version===await digest(credential().value);
  return {user:allowed?{displayName:'MOD'}:null,allowed};
 }catch{return {user:null,allowed:false}}
}
export async function loginBudget(request:Request){
 const now=Date.now(),window=15*60*1000,bucket=Math.floor(now/window),expires=(bucket+1)*window;
 const ip=request.headers.get('cf-connecting-ip')||'unavailable';
 const ipKey='ip:'+await digest(ip)+':'+bucket,globalKey='global:'+bucket;
 const db=database();
 const results=await db.batch<{attempts:number}>([ipKey,globalKey].map(key=>db.prepare('INSERT INTO admin_login_limits (key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,expires)));
 const allowed=Number(results[0].results[0]?.attempts)<=5&&Number(results[1].results[0]?.attempts)<=30;
 return {allowed,ipKey,retryAfter:Math.max(1,Math.ceil((expires-now)/1000))};
}
export async function newSession(request:Request,ipKey:string){
 const token=hex(crypto.getRandomValues(new Uint8Array(32))),db=database(),old=sessionFromCookie(request.headers.get('cookie')||''),now=Date.now();
 await db.batch([
  db.prepare('INSERT INTO admin_sessions (token_hash,expires,credential_version) VALUES (?,?,?)').bind(await digest(token),now+SESSION_SECONDS*1000,await digest(credential().value)),
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ? OR expires <= ?').bind(await digest(old),now),
  db.prepare('DELETE FROM admin_login_limits WHERE key = ? OR expires <= ?').bind(ipKey,now)
 ]);
 return token;
}
export async function revokeSession(request:Request){
 const token=sessionFromCookie(request.headers.get('cookie')||'');
 if(/^[a-f0-9]{64}$/.test(token))await database().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).run();
}
