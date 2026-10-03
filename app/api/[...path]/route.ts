import {data,hasDrink,recommend,graphView,type Constraints} from '@/lib/recommendation';
import {favoritesFor,saveFavorite} from '@/db/storage';
const valid=(s:string)=>/^(?:[a-f0-9]{64}|web_[a-f0-9-]{36})$/.test(s);
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('')}
async function handle(request:Request){
 const url=new URL(request.url),path=url.pathname;
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('drink-session='))?.slice(14)||'';
 let token=valid(cookie)?cookie:randomToken();
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Set-Cookie':`drink-session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`}});
 try{
  if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return reply({message:'請從本站送出操作'},403);
  if(request.method==='GET'){
   if(path==='/api/health')return reply({status:'healthy',service:'Drink Recommendation Engine'});
   if(path==='/api/catalog')return reply({status:'success',data:data.catalog});
   if(path==='/api/model')return reply({status:'success',data:{scoring:'neural_embedding_and_graph_rules',neural_model:data.model}});
   const history=await favoritesFor(await hash(token));
   if(path==='/api/profile')return reply({status:'success',data:{count:history.length,recovery_code:token}});
   if(path==='/api/graph')return reply({status:'success',data:graphView(history.map(r=>r.drink),url.searchParams.get('brand')||'',url.searchParams.get('query')||'',Math.max(1,Math.min(40,Number(url.searchParams.get('limit'))||12)))});
  }
  if(request.method==='POST'){
   if(Number(request.headers.get('content-length')||0)>100000)return reply({message:'資料過大'},413);
   const text=await request.text();if(text.length>100000)return reply({message:'資料過大'},413);
   const body=JSON.parse(text);
   if(path==='/api/restore'){
    if(typeof body.code!=='string'||!valid(body.code))return reply({message:'請輸入有效的恢復碼或舊網站識別碼'},400);
    const rows=await favoritesFor(await hash(body.code));
    if(!rows.length)return reply({message:'找不到這個代碼的收藏紀錄，請確認代碼是否完整。'},404);
    token=body.code;return reply({status:'success'});
   }
   const owner=await hash(token);
   if(path==='/api/favorite'){
    if(typeof body.drink_id!=='string'||!hasDrink(body.drink_id))return reply({message:'找不到飲料'},400);
    await saveFavorite(owner,body.drink_id);return reply({status:'success'});
   }
   if(path==='/api/recommend'){
    if(typeof body.query!=='string'||body.query.length>2000)return reply({message:'請輸入 2000 字以內的偏好'},400);
    const c:Constraints=body.constraints||{};
    if(typeof c!=='object'||Array.isArray(c)||c.brand!=null&&typeof c.brand!=='string'||c.allergens!=null&&(!Array.isArray(c.allergens)||c.allergens.some(a=>typeof a!=='string'))||c.excluded_ids!=null&&(!Array.isArray(c.excluded_ids)||c.excluded_ids.length>2000||c.excluded_ids.some(x=>typeof x!=='string'))||[c.max_price,c.min_price].some(v=>v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<0)))return reply({message:'篩選條件不正確'},400);
    const rows=await favoritesFor(owner),recs=recommend(body.query,c,rows.map(r=>r.drink));
    return reply({status:'success',data:{recommendations:recs,count:recs.length}});
   }
  }
  return reply({message:'找不到頁面'},404);
 }catch(error){console.error('Drink API error',error instanceof Error?error.message:'unknown');return reply({status:'error',message:'服務暫時無法完成，請稍後再試。'},503)}
}
export const GET=handle;export const POST=handle;
