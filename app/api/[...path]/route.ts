import {data,hasDrink,recommend,graphView,type Constraints} from '@/lib/recommendation';
import {catalogOverview,favoritesFor,saveFavorite} from '@/db/storage';
import {accountCookie,accountFor,loginAccount,logoutAccount,registerAccount,validPassword,validUsername} from '@/lib/user-auth';
const valid=(s:string)=>/^(?:[a-f0-9]{64}|web_[a-f0-9-]{36})$/.test(s);
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('')}
async function handle(request:Request){
 const url=new URL(request.url),path=url.pathname;
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('drink-session='))?.slice(14)||'';
 let token=valid(cookie)?cookie:randomToken();
 const reply=(body:unknown,status=200,extraCookies:string[]=[],extraHeaders:Record<string,string>={})=>{const headers=new Headers({'Cache-Control':'no-store',...extraHeaders});headers.append('Set-Cookie',`drink-session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`);for(const cookie of extraCookies)headers.append('Set-Cookie',cookie);return Response.json(body,{status,headers})};
 try{
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply({message:'請從本站送出操作'},403);
  if(request.method==='GET'){
   if(path==='/api/health')return reply({status:'healthy',service:'Drink Recommendation Engine'});
   if(path==='/api/catalog'){const catalog=await catalogOverview();return reply({status:'success',data:{...data.catalog,...catalog}})}
   if(path==='/api/model')return reply({status:'success',data:{scoring:'neural_embedding_and_graph_rules',neural_model:data.model}});
   if(path==='/api/auth/me'){const account=await accountFor(request);return reply({status:'success',data:{account:account?.username||null}})}
   if(path==='/api/profile'){const account=await accountFor(request),owner=account?`account:${account.id}`:await hash(token),history=await favoritesFor(owner);return reply({status:'success',data:{count:history.length,recovery_code:account?null:token,account:account?.username||null}})}
   const account=await accountFor(request),owner=account?`account:${account.id}`:await hash(token),history=await favoritesFor(owner);
   if(path==='/api/graph')return reply({status:'success',data:graphView(history.map(r=>r.drink),url.searchParams.get('brand')||'',url.searchParams.get('query')||'',Math.max(1,Math.min(40,Number(url.searchParams.get('limit'))||12)))});
  }
  if(request.method==='POST'){
   if(path==='/api/auth/logout'){await logoutAccount(request);return reply({status:'success'},200,[accountCookie('',request.url,0)])}
   const bodyLimit=path.startsWith('/api/auth/')?4096:100000;
   if(Number(request.headers.get('content-length')||0)>bodyLimit)return reply({message:'資料過大'},413);
   const text=await request.text();if(text.length>bodyLimit)return reply({message:'資料過大'},413);
   let body:Record<string,unknown>;try{const parsed=JSON.parse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return reply({message:'資料格式不正確'},400);body=parsed}catch{return reply({message:'資料格式不正確'},400)}
   if(path==='/api/auth/register'||path==='/api/auth/login'){
    if(text.length>4096||typeof body.username!=='string'||body.username.length>24||typeof body.password!=='string'||body.password.length>64)return reply({message:'請檢查 ID 與密碼格式。'},400);
    if(path==='/api/auth/register'&&(!validUsername(body.username)||!validPassword(body.password)))return reply({message:'ID 需為 4–24 位英數字；密碼需為 12–64 位英數字，並包含英文大小寫與數字。'},400);
    if(path==='/api/auth/login'&&!validUsername(body.username))return reply({message:'ID 或密碼不正確。'},401);
    const result=path==='/api/auth/register'?await registerAccount(request,body.username,body.password):await loginAccount(request,body.username,body.password);
    if(result.status!==200){const headers=result.status===429?{'Retry-After':String(result.retryAfter||1)}:{};return reply({message:result.message},result.status,[],headers)}
    return reply({status:'success',data:{username:result.user.username}},200,[accountCookie(result.token,request.url)]);
   }
   if(path==='/api/restore'){
    if(typeof body.code!=='string'||!valid(body.code))return reply({message:'請輸入有效的恢復碼或舊網站識別碼'},400);
    const rows=await favoritesFor(await hash(body.code));
    if(!rows.length)return reply({message:'找不到這個代碼的收藏紀錄，請確認代碼是否完整。'},404);
    token=body.code;return reply({status:'success'});
   }
   const account=await accountFor(request),owner=account?`account:${account.id}`:await hash(token);
   if(path==='/api/favorite'){
    if(typeof body.drink_id!=='string'||!hasDrink(body.drink_id))return reply({message:'找不到飲料'},400);
    await saveFavorite(owner,body.drink_id);return reply({status:'success'});
   }
   if(path==='/api/recommend'){
    if(typeof body.query!=='string'||body.query.length>2000)return reply({message:'請輸入 2000 字以內的偏好'},400);
    const c:Constraints=(body.constraints||{}) as Constraints;
    if(typeof c!=='object'||Array.isArray(c)||c.brand!=null&&typeof c.brand!=='string'||c.allergens!=null&&(!Array.isArray(c.allergens)||c.allergens.some(a=>typeof a!=='string'))||c.excluded_ids!=null&&(!Array.isArray(c.excluded_ids)||c.excluded_ids.length>2000||c.excluded_ids.some(x=>typeof x!=='string'))||[c.max_price,c.min_price].some(v=>v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<0)))return reply({message:'篩選條件不正確'},400);
    const rows=await favoritesFor(owner),recs=recommend(body.query,c,rows.map(r=>r.drink));
    return reply({status:'success',data:{recommendations:recs,count:recs.length}});
   }
  }
  return reply({message:'找不到頁面'},404);
 }catch(error){console.error('Drink API error',error instanceof Error?error.message:'unknown');return reply({status:'error',message:'服務暫時無法完成，請稍後再試。'},503)}
}
export const GET=handle;export const POST=handle;
