import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
export const favorites = sqliteTable('favorites', {
  owner: text('owner').notNull(),
  drink: text('drink').notNull(),
  timestamp: text('timestamp').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.drink] })]);
export const imports = sqliteTable('imports', { id: text('id').primaryKey(), timestamp: text('timestamp').notNull() });
