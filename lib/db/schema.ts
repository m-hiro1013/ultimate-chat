/**
 * Dexie.js DBスキーマ定義
 * IndexedDBを使用した会話履歴・ユーザー設定の永続化
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Conversation, UserPreferences } from '@/types';

/**
 * Ultimate Chat データベース
 * conversations: 会話履歴
 * preferences: ユーザー設定（長期記憶）
 */
const db = new Dexie('UltimateChatDB') as Dexie & {
    conversations: EntityTable<Conversation, 'id'>;
    preferences: EntityTable<UserPreferences, 'id'>;
};

// データベーススキーマ定義
db.version(1).stores({
    conversations: 'id, title, createdAt, updatedAt',
    preferences: 'id, updatedAt',
});

export { db };
