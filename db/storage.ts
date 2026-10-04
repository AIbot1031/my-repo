import { env } from 'cloudflare:workers';
import legacy from '@/lib/data/legacy.json';
import { data } from '@/lib/recommendation';
export function database(): D1Database {
  const db = (env as unknown as {DB:D1Database}).DB;
  if (!db) throw new Error('Database unavailable');
  return db;
}
export async function seedLegacy() {
  const db=database();
  if(await db.prepare('SELECT id FROM imports WHERE id = ?').bind('legacy-2026-10-04').first()) return;
  await db.batch([
    ...legacy.map(row=>db.prepare('INSERT OR IGNORE INTO favorites (owner,drink,timestamp) VALUES (?,?,?)').bind(row.owner,row.drink,row.timestamp)),
    db.prepare('INSERT OR IGNORE INTO imports (id,timestamp) VALUES (?,?)').bind('legacy-2026-10-04',new Date().toISOString())
  ]);
}
export async function favoritesFor(owner:string) {
  await seedLegacy();
  const r=await database().prepare('SELECT drink,timestamp FROM favorites WHERE owner = ? ORDER BY timestamp,drink').bind(owner).all<{drink:string,timestamp:string}>();
  return r.results;
}
export async function saveFavorite(owner:string,drink:string) {
  await seedLegacy();
  await database().prepare('INSERT OR IGNORE INTO favorites (owner,drink,timestamp) VALUES (?,?,?)').bind(owner,drink,new Date().toISOString()).run();
}

export async function catalogOverview() {
  const db=database(), version=`catalog-${data.catalog.sha256}`;
  const marker=await db.prepare('SELECT id FROM imports WHERE id = ?').bind(version).first();
  const current=await db.prepare('SELECT COUNT(*) AS count FROM catalog_drinks WHERE catalog_version = ?').bind(version).first<{count:number}>();
  if(!marker||Number(current?.count)!==data.drinks.length){
    for(let start=0;start<data.drinks.length;start+=50){
      const batch=data.drinks.slice(start,start+50).map(drink=>db.prepare(
        'INSERT INTO catalog_drinks (id,source_row,brand,item_name,price,catalog_version,payload) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET source_row=excluded.source_row,brand=excluded.brand,item_name=excluded.item_name,price=excluded.price,catalog_version=excluded.catalog_version,payload=excluded.payload'
      ).bind(drink.id,Number(drink.metadata.source_row)||0,String(drink.metadata.brand||''),drink.name,drink.price,version,JSON.stringify(drink)));
      await db.batch(batch);
    }
    await db.batch([
      db.prepare('DELETE FROM catalog_drinks WHERE catalog_version != ?').bind(version),
      db.prepare('INSERT OR IGNORE INTO imports (id,timestamp) VALUES (?,?)').bind(version,new Date().toISOString()),
    ]);
  }
  const rows=await db.prepare('SELECT brand,COUNT(*) AS count FROM catalog_drinks WHERE catalog_version = ? GROUP BY brand ORDER BY brand COLLATE NOCASE').bind(version).all<{brand:string,count:number}>();
  return {count:rows.results.reduce((sum,row)=>sum+Number(row.count),0),brands:rows.results.map(row=>row.brand)};
}
