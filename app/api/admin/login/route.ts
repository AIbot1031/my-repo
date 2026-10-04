import {loginBudget,verifyPassword,newSession,adminCookie} from '@/lib/admin-auth';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'請從本站登入頁送出'},{status:403,headers});
 try{
  if(Number(request.headers.get('content-length')||0)>4096)return Response.json({message:'資料過大'},{status:413,headers});
  const text=await request.text();if(text.length>4096)return Response.json({message:'資料過大'},{status:413,headers});
  let body;try{body=JSON.parse(text)}catch{return Response.json({message:'請輸入帳號與密碼'},{status:400,headers})}
  if(typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>50||body.password.length>256)return Response.json({message:'請輸入帳號與密碼'},{status:400,headers});
  const budget=await loginBudget(request);
  if(!budget.allowed)return Response.json({message:'登入嘗試過多，請稍後再試。',retry_after:budget.retryAfter},{status:429,headers:{...headers,'Retry-After':String(budget.retryAfter)}});
  const valid=await verifyPassword(body.password);
  if(body.username!=='MOD'||!valid)return Response.json({message:'帳號或密碼不正確'},{status:401,headers});
  const token=await newSession(request,budget.ipKey);
  return Response.json({status:'success'},{headers:{...headers,'Set-Cookie':adminCookie(token,request.url)}});
 }catch{return Response.json({message:'登入服務暫時無法使用，請稍後再試。'},{status:503,headers})}
}
