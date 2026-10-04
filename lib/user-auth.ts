import { database } from '@/db/storage';

const ACCOUNT_COOKIE='drink-account';
const SESSION_SECONDS=7*24*60*60;
const PASSWORD_ITERATIONS=600_000;
const MAX_WEBCRYPTO_ITERATIONS=100_000;
const WINDOW_MS=15*60*1000;
const LIMIT=5;
const encoder=new TextEncoder();
const hex=(value:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(value)).map(n=>n.toString(16).padStart(2,'0')).join('');
const fromHex=(value:string)=>new Uint8Array(value.match(/../g)?.map(x=>parseInt(x,16))||[]);
const digest=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const randomHex=(bytes:number)=>hex(crypto.getRandomValues(new Uint8Array(bytes)));
const usernameKey=(value:string)=>value.toLowerCase();

export const validUsername=(value:string)=>/^[A-Za-z0-9]{4,24}$/.test(value);
export const validPassword=(value:string)=>/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[A-Za-z0-9]{12,64}$/.test(value);

async function passwordHash(password:string,salt:string,iterations:number){
  // Workers caps one Web Crypto PBKDF2 call at 100,000 iterations. Chain
  // bounded, domain-separated PBKDF2 stages to retain the intended total work.
  const baseSalt=fromHex(salt);let input=encoder.encode(password),result=new Uint8Array();
  for(let round=0;round<iterations;round+=MAX_WEBCRYPTO_ITERATIONS){
    const stageSalt=new Uint8Array(baseSalt.length+4);stageSalt.set(baseSalt);new DataView(stageSalt.buffer).setUint32(baseSalt.length,round/MAX_WEBCRYPTO_ITERATIONS,false);
    const key=await crypto.subtle.importKey('raw',input,'PBKDF2',false,['deriveBits']);
    result=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:stageSalt,iterations:Math.min(MAX_WEBCRYPTO_ITERATIONS,iterations-round)},key,256));input=result;
  }
  return result;
}
function equal(a:Uint8Array,b:Uint8Array){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);return diff===0;}
function accountToken(request:Request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(`${ACCOUNT_COOKIE}=`))?.slice(ACCOUNT_COOKIE.length+1)||'';}
function anonymousToken(request:Request){const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('drink-session='))?.slice(14)||'';return /^(?:[a-f0-9]{64}|web_[a-f0-9-]{36})$/.test(token)?token:'';}
export function accountCookie(token:string,url:string,maxAge=SESSION_SECONDS){return `${ACCOUNT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(url).protocol==='https:'?'; Secure':''}`;}

async function rateLimit(request:Request,action:'register'|'login',key:string){
  const db=database(),now=Date.now(),bucket=Math.floor(now/WINDOW_MS),expires=(bucket+1)*WINDOW_MS;
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const keys=[`${action}:ip:${await digest(ip)}:${bucket}`,`${action}:user:${await digest(key)}:${bucket}`];
  const results=await db.batch<{attempts:number}>([
    db.prepare('DELETE FROM account_login_limits WHERE expires <= ?').bind(now),
    ...keys.map(value=>db.prepare('INSERT INTO account_login_limits (key,attempts,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(value,expires)),
  ]);
  const counts=results.slice(1).map(result=>Number(result.results[0]?.attempts||0));
  return {allowed:counts.every(count=>count<=LIMIT),keys,retryAfter:Math.max(1,Math.ceil((expires-now)/1000))};
}
async function clearLimits(keys:string[]){if(keys.length)await database().batch(keys.map(key=>database().prepare('DELETE FROM account_login_limits WHERE key = ?').bind(key)));}

async function mergeAnonymousFavorites(request:Request,userId:number){
  const token=anonymousToken(request);if(!token)return;
  const source=await digest(token),target=`account:${userId}`;
  await database().batch([
    database().prepare('INSERT OR IGNORE INTO favorites (owner,drink,timestamp) SELECT ?,drink,timestamp FROM favorites WHERE owner = ?').bind(target,source),
    database().prepare('DELETE FROM favorites WHERE owner = ?').bind(source),
  ]);
}
async function makeSession(request:Request,userId:number){
  const token=randomHex(32),old=accountToken(request),db=database(),now=Date.now();
  await db.batch([
    db.prepare('INSERT INTO user_sessions (token_hash,user_id,expires,created_at) VALUES (?,?,?,?)').bind(await digest(token),userId,now+SESSION_SECONDS*1000,now),
    db.prepare('DELETE FROM user_sessions WHERE token_hash = ? OR expires <= ?').bind(/^[a-f0-9]{64}$/.test(old)?await digest(old):'',now),
  ]);
  await mergeAnonymousFavorites(request,userId);
  return token;
}

export async function accountFor(request:Request){
  const token=accountToken(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
  return database().prepare('SELECT u.id,u.username FROM user_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash = ? AND s.expires > ?').bind(await digest(token),Date.now()).first<{id:number;username:string}>();
}

export async function registerAccount(request:Request,username:string,password:string){
  const key=usernameKey(username),budget=await rateLimit(request,'register',key);
  if(!budget.allowed)return {status:429,message:'註冊嘗試過多，請稍後再試。',retryAfter:budget.retryAfter} as const;
  const salt=randomHex(16),hash=hex(await passwordHash(password,salt,PASSWORD_ITERATIONS)),now=Date.now();
  const user=await database().prepare('INSERT INTO app_users (username,username_key,password_salt,password_hash,password_iterations,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(username_key) DO NOTHING RETURNING id,username').bind(username,key,salt,hash,PASSWORD_ITERATIONS,now).first<{id:number;username:string}>();
  if(!user)return {status:409,message:'這個 ID 已有人使用，請換一個 ID。'} as const;
  await clearLimits(budget.keys);
  const token=await makeSession(request,user.id);
  return {status:200,user,token} as const;
}

export async function loginAccount(request:Request,username:string,password:string){
  const key=usernameKey(username),budget=await rateLimit(request,'login',key);
  if(!budget.allowed)return {status:429,message:'登入嘗試過多，請稍後再試。',retryAfter:budget.retryAfter} as const;
  const user=await database().prepare('SELECT id,username,password_salt,password_hash,password_iterations FROM app_users WHERE username_key = ?').bind(key).first<{id:number;username:string;password_salt:string;password_hash:string;password_iterations:number}>();
  const safeIterations=user&&Number.isInteger(user.password_iterations)&&user.password_iterations>=MAX_WEBCRYPTO_ITERATIONS&&user.password_iterations<=1_000_000&&user.password_iterations%MAX_WEBCRYPTO_ITERATIONS===0?user.password_iterations:PASSWORD_ITERATIONS;
  const salt=user?.password_salt||'00112233445566778899aabbccddeeff';
  const expected=user?.password_hash||'0000000000000000000000000000000000000000000000000000000000000000';
  const actual=await passwordHash(password,salt,safeIterations);
  if(!user||!equal(actual,fromHex(expected))||!validPassword(password))return {status:401,message:'ID 或密碼不正確。'} as const;
  await clearLimits(budget.keys);
  const token=await makeSession(request,user.id);
  return {status:200,user:{id:user.id,username:user.username},token} as const;
}

export async function logoutAccount(request:Request){
  const token=accountToken(request);if(/^[a-f0-9]{64}$/.test(token))await database().prepare('DELETE FROM user_sessions WHERE token_hash = ?').bind(await digest(token)).run();
}
