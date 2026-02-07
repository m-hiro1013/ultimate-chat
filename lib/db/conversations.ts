/**
 * 会話CRUD操作
 * 会話の作成、取得、更新、削除を提供
 */

import { db } from './schema';
import type { Conversation, Message, ChatMode, ConversationSummary } from '@/types';

/**
 * 新しい会話を作成
 * @param mode - 会話モード（デフォルト: general）
 * @returns 作成された会話
 */
export async function createConversation(mode: ChatMode = 'general'): Promise<Conversation> {
    const now = new Date();
    const id = crypto.randomUUID();

    const conversation: Conversation = {
        id,
        title: '新しい会話',
        messages: [],
        mode,
        createdAt: now,
        updatedAt: now,
    };

    await db.conversations.add(conversation);
    return conversation;
}

/**
 * 会話を取得
 * @param id - 会話ID
 * @returns 会話（見つからない場合はundefined）
 */
export async function getConversation(id: string): Promise<Conversation | undefined> {
    return await db.conversations.get(id);
}

/**
 * 全会話を取得（新しい順）
 * @returns 会話一覧
 */
export async function getAllConversations(): Promise<Conversation[]> {
    return await db.conversations
        .orderBy('updatedAt')
        .reverse()
        .toArray();
}

/**
 * 会話にメッセージを追加
 * @param id - 会話ID
 * @param message - 追加するメッセージ
 * @returns 更新後の会話
 */
export async function addMessage(id: string, message: Message): Promise<Conversation | undefined> {
    const conversation = await db.conversations.get(id);
    if (!conversation) return undefined;

    const updatedMessages = [...conversation.messages, message];
    const now = new Date();

    // タイトルが「新しい会話」の場合、最初のユーザーメッセージからタイトルを生成
    let title = conversation.title;
    if (title === '新しい会話' && message.role === 'user') {
        title = generateTitle(message.content);
    }

    await db.conversations.update(id, {
        messages: updatedMessages,
        title,
        updatedAt: now,
    });

    return await db.conversations.get(id);
}

/**
 * 会話のモードを更新
 * @param id - 会話ID
 * @param mode - 新しいモード
 */
export async function updateConversationMode(id: string, mode: ChatMode): Promise<void> {
    await db.conversations.update(id, {
        mode,
        updatedAt: new Date(),
    });
}

/**
 * 会話のタイトルを更新
 * @param id - 会話ID
 * @param title - 新しいタイトル
 */
export async function updateConversationTitle(id: string, title: string): Promise<void> {
    await db.conversations.update(id, {
        title,
        updatedAt: new Date(),
    });
}

/**
 * 会話の要約を更新（中期記憶）
 * @param id - 会話ID
 * @param summary - 会話の要約
 */
export async function updateConversationSummary(
    id: string,
    summary: ConversationSummary
): Promise<void> {
    await db.conversations.update(id, {
        summary,
        updatedAt: new Date(),
    });
}

/**
 * 会話を削除
 * @param id - 会話ID
 */
export async function deleteConversation(id: string): Promise<void> {
    await db.conversations.delete(id);
}

/**
 * 全会話を削除
 */
export async function deleteAllConversations(): Promise<void> {
    await db.conversations.clear();
}

/**
 * メッセージ内容からタイトルを生成
 * @param content - メッセージ内容
 * @returns 生成されたタイトル（最大30文字）
 */
function generateTitle(content: string): string {
    // 改行を除去し、最初の30文字を取得
    const cleaned = content.replace(/\n/g, ' ').trim();
    if (cleaned.length <= 30) {
        return cleaned;
    }
    return cleaned.slice(0, 30) + '...';
}
