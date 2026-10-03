export function sessionToken(request:Request){
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('drink-session='))?.slice(14)||'';
 return /^(?:[a-f0-9]{64}|web_[a-f0-9-]{36})$/.test(cookie)?cookie:Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function cookieHeader(token:string,url:string){return `drink-session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(url).protocol==='https:'?'; Secure':''}`}
