import {adminAccess} from '@/lib/admin-auth';
import {chatGPTSignInPath,chatGPTSignOutPath} from '@/app/chatgpt-auth';
import html from '@/lib/admin-page.json';
export const dynamic='force-dynamic';
export async function GET(){
 const {user,allowed}=await adminAccess();
 const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie'};
 if(!allowed)return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>管理員登入</title><body style="font:16px system-ui;background:#f4f6ef;color:#203b33;padding:8vw"><main style="max-width:560px;margin:auto"><a href="/">返回飲料推薦</a><h1>雲端資料管理</h1><p>${user?'目前登入的帳號沒有管理權限。請切換成建立這個網站的 ChatGPT 帳號。':'請使用建立這個網站的 ChatGPT 帳號登入，查看收藏統計與匯出資料。'}</p><a target="_top" href="${user?chatGPTSignOutPath('/admin'):chatGPTSignInPath('/admin')}" style="display:inline-block;padding:14px 22px;background:#245d46;color:white;border-radius:10px">${user?'登出並切換帳號':'使用 ChatGPT 登入'}</a></main></body></html>`,{status:user?403:200,headers});
 return new Response(html,{headers});
}
