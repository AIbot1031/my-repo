import {revokeSession,adminCookie} from '@/lib/admin-auth';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({message:'請從本站登出'},{status:403});
 try{await revokeSession(request);return Response.json({status:'success'},{headers:{'Cache-Control':'no-store','Set-Cookie':adminCookie('',request.url,0)}})}catch{return Response.json({message:'登出失敗，請再試一次。'},{status:503})}
}
