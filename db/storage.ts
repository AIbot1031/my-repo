import { env } from 'cloudflare:workers';
import legacy from '@/lib/data/legacy.json';
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
