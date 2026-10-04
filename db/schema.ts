import { sqliteTable, text, primaryKey, integer, index } from 'drizzle-orm/sqlite-core';
export const favorites = sqliteTable('favorites', {
  owner: text('owner').notNull(),
  drink: text('drink').notNull(),
  timestamp: text('timestamp').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.drink] })]);
export const imports = sqliteTable('imports', { id: text('id').primaryKey(), timestamp: text('timestamp').notNull() });

export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  expires: integer('expires').notNull(),
  credentialVersion: text('credential_version').notNull(),
}, table => [index('admin_session_expiry').on(table.expires)]);
export const adminLoginLimits = sqliteTable('admin_login_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  expires: integer('expires').notNull(),
}, table => [index('admin_login_limit_expiry').on(table.expires)]);
