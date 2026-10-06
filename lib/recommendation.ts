import raw from './data/catalog.json';
type Drink={id:string;name:string;type:string;price:number|null;metadata:Record<string,unknown>;attributes:Record<string,unknown>};
type Node={id:string;type:string;label:string;brand?:string;source_row?:number;price?:number|null};
type Edge={source:string;target:string;type:string;label:string;source_kind:string;source_row?:number;source_column?:string};
type Catalog={drinks:Drink[];catalog:Record<string,unknown>;idf:Record<string,number>;tfidf:Record<string,Record<string,number>>;vectors:Record<string,number[]>;model:Record<string,unknown>;graph:{nodes:Node[];edges:Edge[];features:Record<string,string[]>}};
export const data=raw as unknown as Catalog;
const byId=new Map(data.drinks.map(d=>[d.id,d]));
export const hasDrink=(id:string)=>byId.has(id);
function sourceText(d:Drink){return [d.name,d.type,d.metadata.flavor,d.metadata.notes,d.attributes['風味']].filter(Boolean).join(' ')}
function usesMilk(d:Drink){return Boolean(d.attributes['奶類'])||/(奶茶|奶烏|奶普|奶霜|奶蓋|奶油|奶酪|鮮奶|牛乳|牛奶|奶精|奶香|奶類)/u.test(sourceText(d))}
function containsDairy(d:Drink){
 const milk=String(d.attributes['奶類']||''),allergen=String(d.attributes['過敏原']||'');
 return /乳製品/u.test(allergen)||/鮮乳|奶精/u.test(milk)||/(乳製品|鮮奶|牛乳|牛奶|奶茶|奶烏|奶普|奶霜|奶蓋|奶油|奶酪|奶香|芝士|起司|優格|優酪|乳酸|養樂多|多多|優多)/u.test(sourceText(d));
}
const norm=(v:number[])=>Math.sqrt(v.reduce((s,x)=>s+x*x,0));
const norms=Object.fromEntries(Object.entries(data.tfidf).map(([id,v])=>[id,norm(Object.values(v))]));
function tokens(text:string){
 const s=text.toLowerCase().replace(/\s+/gu,''), chars=Array.from(s), values=[...chars.filter(c=>/[\u4e00-\u9fff]/u.test(c)),...chars.slice(0,-1).map((c,i)=>c+chars[i+1]),...(s.match(/[a-z0-9]+/g)||[])];
 const counts:Record<string,number>=Object.create(null);for(const t of values)counts[t]=(counts[t]||0)+1;
 return Object.fromEntries(Object.entries(counts).map(([t,n])=>[t,n*(data.idf[t]??1)]));
}
const semanticAliases:[RegExp,string[]][]=[
 [/清爽|清新|爽口/u,['清香','淡雅','回甘']],
 [/濃郁|濃厚|醇厚/u,['奶香','厚實','香醇']],
 [/酸甜|果香|水果/u,['果汁','莓果','柑橘']],
 [/提神|醒腦/u,['咖啡因','茶香']],
 [/放鬆|療癒/u,['溫潤','順口']],
 [/有嚼勁|咀嚼/u,['珍珠','波霸','椰果']],
];
function expandSemanticQuery(query:string){
 const additions=semanticAliases.filter(([pattern])=>pattern.test(query)).flatMap(([,words])=>words);
 return additions.length?`${query} ${additions.join(' ')}`:query;
}
function caffeineUpperBound(value:unknown){
 if(typeof value==='number'&&Number.isFinite(value))return value;
 const text=String(value??'').replaceAll(',','').trim();
 if(!text||/[≥>]|以上|超過/u.test(text))return null;
 const numbers=[...text.matchAll(/\d+(?:\.\d+)?/gu)].map(match=>Number(match[0]));
 return numbers.length?Math.max(...numbers):null;
}
function parseNegativePreferences(query:string){
 const rules:{pattern:RegExp;matches:(d:Drink)=>boolean}[]=[];
 let positive=query;
 const negative=/(不要|不想喝|不想要|不喝|不喜歡|不愛|避免|避開|不含)([^，。！？、\s]{1,12})/gu;
 for(const match of query.matchAll(negative)){
  const target=match[2];
  if(/奶茶/u.test(target)) rules.push({pattern:/奶茶/u,matches:usesMilk});
  else if(/奶|乳/u.test(target)) rules.push({pattern:/奶|乳/u,matches:usesMilk});
  else if(/咖啡因/u.test(target)) rules.push({pattern:/咖啡因/u,matches:d=>d.attributes['咖啡因']===true});
  else if(/甜/u.test(target)) rules.push({pattern:/甜/u,matches:d=>/甜|糖香|蜜香|酸甜|甜潤|甜香/u.test(String(d.attributes['風味']||d.metadata.flavor||''))});
  else if(target.length>1) rules.push({pattern:new RegExp(target.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&'),'u'),matches:d=>[d.name,d.type,String(d.metadata.flavor||''),String(d.attributes['風味']||'')].some(v=>v.includes(target))});
  positive=positive.replace(match[0],' ');
 }
 const structured:{name:string;matches:(d:Drink)=>boolean}[]=[];
 if(/低熱量|低卡|熱量較低/u.test(positive))structured.push({name:'低熱量（≤200 kcal）',matches:d=>typeof d.metadata.calories_kcal==='number'&&d.metadata.calories_kcal<=200});
 if(/無咖啡因|不含咖啡因|低咖啡因/u.test(positive))structured.push({name:'低／無咖啡因',matches:d=>d.attributes['咖啡因']===false||(/低咖啡因/u.test(positive)&&caffeineUpperBound(d.metadata.caffeine_mg)!=null&&caffeineUpperBound(d.metadata.caffeine_mg)!<=100)});
 positive=positive.replace(/低熱量|低卡|熱量較低|無咖啡因|不含咖啡因|低咖啡因/gu,' ');
 return {positive:positive.trim(),rules,structured};
}
export type Constraints={brand?:string;caffeine_free?:boolean;allergens?:string[];max_price?:number;min_price?:number;excluded_ids?:string[]};
export function recommend(query:string,constraints:Constraints,history:string[]){
 const excluded=new Set(constraints.excluded_ids||[]);
 const {positive,rules,structured}=parseNegativePreferences(query);
 // Path A applies structured filters first, then retrieves the closest catalog
 // documents by cosine similarity, following the Python/Chroma flow in TS.
 const allowed=data.drinks.filter(d=>!excluded.has(d.id)&&!rules.some(rule=>rule.matches(d))&&!structured.some(filter=>!filter.matches(d))&&(!constraints.brand||d.metadata.brand===constraints.brand)&&(!constraints.caffeine_free||d.attributes['咖啡因']===false)&&!(constraints.allergens||[]).some(a=>/乳製品|乳類|奶類/u.test(a)?containsDairy(d):String(d.attributes['過敏原']||'').toLowerCase().includes(a.toLowerCase()))&&(constraints.max_price==null||(d.price!=null&&d.price<=constraints.max_price))&&(constraints.min_price==null||(d.price!=null&&d.price>=constraints.min_price)));
 const q=tokens(expandSemanticQuery(positive||'推薦')), qnorm=norm(Object.values(q));
 const ordered=(a:{id:string;score:number},b:{id:string;score:number})=>b.score-a.score||(a.id<b.id?-1:a.id>b.id?1:0);
 const a=allowed.map(d=>({id:d.id,score:qnorm&&norms[d.id]?Object.entries(q).reduce((s,[t,v])=>s+v*(data.tfidf[d.id]?.[t]||0),0)/(qnorm*norms[d.id]):0})).sort(ordered).slice(0,10);
 const vectors=history.map(id=>data.vectors[id]).filter(Boolean);
 const profile=vectors.length?vectors[0].map((_,i)=>vectors.reduce((s,v)=>s+v[i],0)/vectors.length):[];
 const pn=norm(profile);if(pn)profile.forEach((v,i)=>profile[i]=v/pn);
 const weights:Record<string,number>={brand:.03,tea:.07,milk:.08};
 const b=history.length?allowed.map(d=>{
   let score=.05+history.filter(id=>id===d.id).length*.1;
   const features=new Set(data.graph.features[d.id]||[]);
   for(const prev of history)if(prev!==d.id)for(const f of data.graph.features[prev]||[])if(features.has(f))score+=weights[f.split(':')[0]]||0;
   if(pn&&data.vectors[d.id])score=.8*Math.max(0,Math.min(1,(profile.reduce((s,x,i)=>s+x*data.vectors[d.id][i],0)+1)/2))+.2*Math.min(score,1);
   return {id:d.id,score};
 }).sort(ordered).slice(0,10):[];
 const normalize=(rows:{id:string;score:number}[])=>{const lo=Math.min(...rows.map(r=>r.score)),hi=Math.max(...rows.map(r=>r.score));return new Map(rows.map(r=>[r.id,hi===lo?.5:(r.score-lo)/(hi-lo)]))};
 const na=normalize(a),nb=normalize(b);
 // Same A/B min-max fusion and quality multipliers as the Python implementation.
 const tagSet=new Set<string>();for(const d of allowed)for(const [attr,v] of Object.entries(d.attributes))if(v)tagSet.add(attr+'_'+v);
 const wa=a.length?.3*(tagSet.size>3?1.1:1):0,wb=b.length?.4*(b.length>3?1.1:1):0;
 return [...new Set([...a,...b].map(r=>r.id))].map(id=>({id,score:(wa*(na.get(id)||0)+wb*(nb.get(id)||0))/(wa+wb||1)})).sort((x,y)=>y.score-x.score).slice(0,5).map((r,i)=>{
  const d=byId.get(r.id)!;
  const matched=(data.graph.features[d.id]||[]).filter(feature=>positive&&expandSemanticQuery(positive).includes(feature.split(':').slice(1).join(':'))).slice(0,4);
  return {rank:i+1,drink:{id:d.id,name:d.name,type:d.type,price:d.price,metadata:d.metadata},reason:String(d.metadata.flavor||d.attributes['風味']||'依照你的偏好推薦'),match_tags:matched,warning:null,confidence:r.score};
 });
}
export function graphView(history:string[],brand:string,query:string,limit:number){
 const favorites=new Set(history),user:Node={id:'user:current',type:'user',label:'我的收藏'};
 const interactions:Edge[]=history.filter(hasDrink).map(id=>({source:user.id,target:id,type:'interaction',label:'收藏',source_kind:'actual_user_interaction'}));
 const nodes=[...data.graph.nodes,...(interactions.length?[user]:[])],allEdges=[...data.graph.edges,...interactions];
 const matches=data.graph.nodes.filter(n=>n.type==='drink'&&(!brand||n.brand===brand)&&(!query||n.label.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>Number(favorites.has(b.id))-Number(favorites.has(a.id))||(a.source_row||0)-(b.source_row||0));
 const selected=new Set(matches.slice(0,limit).map(n=>n.id));
 const edges=allEdges.filter(e=>selected.has(e.source)||(e.type==='interaction'&&selected.has(e.target)));
 const ids=new Set([...selected,...edges.flatMap(e=>[e.source,e.target])]);
 const counts:Record<string,number>={};for(const n of nodes)counts[n.type]=(counts[n.type]||0)+1;
 return {nodes:nodes.filter(n=>ids.has(n.id)),edges,total_nodes:nodes.length,total_edges:allEdges.length,node_types:counts,matching_drinks:matches.length,shown_drinks:selected.size,has_history:interactions.length>0,scoring:'neural_embedding_and_graph_rules',model_status:data.model,source:'Excel 品牌、茶種及奶類欄位；收藏來自使用者實際操作'};
}
