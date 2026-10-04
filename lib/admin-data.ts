import { database, seedLegacy } from '@/db/storage';
import { data } from '@/lib/recommendation';
const stamp="strftime('%Y-%m-%dT%H:%M:%fZ', timestamp, CASE WHEN substr(timestamp,-1)='Z' THEN '+0 hours' ELSE '-8 hours' END)";
const drinks=new Map(data.drinks.map(d=>[d.id,d]));
export function filters(url:URL){
 const q=(url.searchParams.get('q')||'').trim().slice(0,100);
 const owner=(url.searchParams.get('owner')||'').trim();
 if(owner&&!/^[a-f0-9]{4,64}$/i.test(owner))throw new Error('使用者代碼請輸入至少 4 位英數代碼');
 const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
 for(const v of [from,to])if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new Error('日期格式不正確');
 if(from&&to&&from>to)throw new Error('起始日期不得晚於結束日期');
 const conditions:string[]=[],args:string[]=[];
 if(owner){conditions.push('substr(owner,1,length(?)) = ?');args.push(owner.toLowerCase(),owner.toLowerCase())}
 if(from){conditions.push(stamp+' >= ?');args.push(new Date(from+'T00:00:00+08:00').toISOString())}
 if(to){conditions.push(stamp+' < ?');args.push(new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000).toISOString())}
 // Catalog labels come from the original Excel. IDs are bound parameters.
 if(q){const ids=data.drinks.filter(d=>(d.name+' '+d.metadata.brand+' '+d.id).toLowerCase().includes(q.toLowerCase())).map(d=>d.id);
   // SQLite D1 has a bind limit; use a JSON array as one bound value.
   conditions.push('drink IN (SELECT value FROM json_each(?))');args.push(JSON.stringify(ids));}
 return {where:conditions.length?' WHERE '+conditions.join(' AND '):'',args};
}
type Row={owner:string;drink:string;timestamp:string};
function enrich(row:Row){const d=drinks.get(row.drink);return {...row,user_label:'使用者 '+row.owner.slice(0,12),name:d?.name||row.drink,brand:String(d?.metadata.brand||''),price:d?.price??null};}
export async function adminData(url:URL){
 await seedLegacy();const db=database(),{where,args}=filters(url);
 const page=Math.max(1,Math.min(100000,Math.floor(Number(url.searchParams.get('page'))||1))),size=25;
 const counts=await db.prepare('SELECT COUNT(*) AS favorites, COUNT(DISTINCT owner) AS users, COUNT(DISTINCT drink) AS drinks, MAX('+stamp+') AS latest FROM favorites').first();
 const total=await db.prepare('SELECT COUNT(*) AS count FROM favorites'+where).bind(...args).first<{count:number}>();
 const rows=await db.prepare('SELECT owner,drink,'+stamp+' AS timestamp FROM favorites'+where+' ORDER BY timestamp DESC,owner,drink LIMIT ? OFFSET ?').bind(...args,size,(page-1)*size).all<Row>();
 const top=await db.prepare('SELECT drink,COUNT(*) AS count FROM favorites GROUP BY drink ORDER BY count DESC,drink LIMIT 10').all<{drink:string;count:number}>();
 return {counts,total:total?.count||0,page,page_size:size,rows:rows.results.map(enrich),top:top.results.map(r=>({...r,name:drinks.get(r.drink)?.name||r.drink,brand:String(drinks.get(r.drink)?.metadata.brand||'')})),catalog_count:data.drinks.length,generated_at:new Date().toISOString()};
}
export async function exportData(url:URL){
 await seedLegacy();const {where,args}=filters(url),db=database();
 const total=await db.prepare('SELECT COUNT(*) AS count FROM favorites'+where).bind(...args).first<{count:number}>();
 if((total?.count||0)>10000)throw new Error('單次匯出上限為 10,000 筆，請縮小日期或使用者範圍。');
 const result=await db.prepare('SELECT owner,drink,'+stamp+' AS timestamp FROM favorites'+where+' ORDER BY timestamp DESC,owner,drink LIMIT 10001').bind(...args).all<Row>();
 if(result.results.length>10000)throw new Error('資料新增後超過匯出上限，請縮小篩選範圍。');
 return result.results.map(enrich);
}
export function csvCell(value:unknown){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
