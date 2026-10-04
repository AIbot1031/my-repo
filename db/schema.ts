import { sqliteTable, text, primaryKey, integer, index, uniqueIndex, real } from 'drizzle-orm/sqlite-core';
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

export const appUsers = sqliteTable('app_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  usernameKey: text('username_key').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordIterations: integer('password_iterations').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('app_users_username_key_unique').on(table.usernameKey)]);

export const userSessions = sqliteTable('user_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  expires: integer('expires').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('user_sessions_expiry').on(table.expires), index('user_sessions_user').on(table.userId)]);

export const accountLoginLimits = sqliteTable('account_login_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  expires: integer('expires').notNull(),
}, table => [index('account_login_limit_expiry').on(table.expires)]);

export const catalogDrinks = sqliteTable('catalog_drinks', {
  id: text('id').primaryKey(),
  sourceRow: integer('source_row').notNull(),
  brand: text('brand').notNull(),
  itemName: text('item_name').notNull(),
  price: real('price'),
  catalogVersion: text('catalog_version').notNull(),
  payload: text('payload').notNull(),
}, table => [index('catalog_drinks_brand').on(table.brand), index('catalog_drinks_version').on(table.catalogVersion)]);
