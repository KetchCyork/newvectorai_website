import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const signups=sqliteTable('signups',{id:text('id').primaryKey(),email:text('email').notNull(),interest:text('interest').notNull(),createdAt:text('created_at').notNull(),notification:text('notification').notNull().default('pending')},t=>[uniqueIndex('signup_email_interest').on(t.email,t.interest)]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const rateLimits=sqliteTable('rate_limits',{bucket:text('bucket').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
