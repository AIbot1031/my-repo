import {adminAccess} from '@/lib/admin-auth';
import {adminData,exportData,csvCell} from '@/lib/admin-data';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const {user,allowed}=await adminAccess();
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
 if(!allowed)return Response.json({message:user?'此帳號沒有管理權限':'請先使用網站擁有者帳號登入'},{status:user?403:401,headers});
 try{
  const url=new URL(request.url),format=url.searchParams.get('format');
  if(format==='csv'||format==='json'){
   const rows=await exportData(url),filename='drink-favorites-'+new Date().toISOString().slice(0,10)+'.'+format;
   const body=format==='json'?JSON.stringify({schema_version:1,exported_at:new Date().toISOString(),timezone:'UTC',records:rows},null,2):'\ufeff'+[['匿名使用者雜湊','飲料代碼','品牌','品名','價格','收藏時間（UTC）'],...rows.map(r=>[r.owner,r.drink,r.brand,r.name,r.price,r.timestamp])].map(r=>r.map(csvCell).join(',')).join('\r\n');
   return new Response(body,{headers:{...headers,'Content-Type':format==='json'?'application/json; charset=utf-8':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`}});
  }
  return Response.json(await adminData(url),{headers});
 }catch(e){console.error('Admin data failure',e instanceof Error?e.message:'unknown');return Response.json({message:e instanceof Error&&/日期|代碼|上限/.test(e.message)?e.message:'資料讀取失敗，請稍後再試。'},{status:400,headers})}
}
