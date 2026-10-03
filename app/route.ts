import html from "@/lib/home-page.json";
import {sessionToken,cookieHeader} from "@/lib/session";
export function GET(request:Request){return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Set-Cookie":cookieHeader(sessionToken(request),request.url)}})}
