import {adminAccess} from '@/lib/admin-auth';
import html from '@/lib/admin-page.json';
import login from '@/lib/admin-login.json';
export const dynamic='force-dynamic';
export async function GET(){
 const {allowed}=await adminAccess();
 return new Response(allowed?html:login,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Frame-Options':'DENY'}});
}
