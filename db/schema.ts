import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const atlasConfig = sqliteTable('atlas_config', {
 id: integer('id').primaryKey(), owner: text('owner').notNull(), salt: text('salt').notNull(), passwordHash: text('password_hash').notNull(),
});
export const atlasSessions = sqliteTable('atlas_sessions', {
 token: text('token').primaryKey(), expires: integer('expires').notNull(),
});
export const atlasAttempts = sqliteTable('atlas_attempts', {
 key: text('key').primaryKey(), count: integer('count').notNull(), expires: integer('expires').notNull(),
});
export const atlasProjects = sqliteTable('atlas_projects', {
 id: text('id').primaryKey(), name: text('name').notNull(), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('idx_atlas_projects_name').on(table.name)]);
export const atlasTrips = sqliteTable('atlas_trips', {
 projectId: text('project_id').references(() => atlasProjects.id), author: text('author').notNull().default(''),
 id: text('id').primaryKey(), status: text('status').notNull(), summary: text('summary').notNull(), uploadId: text('upload_id'), createdAt: text('created_at').notNull(),
}, table => [index('idx_atlas_trips_status_created').on(table.status, table.createdAt)]);
