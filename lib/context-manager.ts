/**
 * コンテキスト管理（クライアントサイド用）
 * 短期/中期/長期のコンテキストを統合管理
 * 
 * 注意: このファイルはクライアントサイド（ブラウザ）でのみ使用すること。
 * API Route（サーバーサイド）からは呼び出さないこと。
 */

import { getConversation, updateConversationSummary } from './db/conversations';
import { getLongTermMemoryString } from './db/preferences';
import type { Message, ConversationSummary } from '@/types';

// 要約が必要になるターン数の閾値
const SUMMARY_THRESHOLD = 20;

// 短期記憶に保持するターン数
const SHORT_TERM_TURNS = 20;

/**
 * 会話のコンテキストを統合して取得（クライアントサイド）
 */
export async function getIntegratedContext(
    conversationId: string,
    allMessages: Message[]
): Promise<{
    shortTermMessages: Message[];
    midTermSummary: ConversationSummary | undefined;
    longTermMemory: string;
}> {
    const longTermMemory = await getLongTermMemoryString();
    const conversation = await getConversation(conversationId);
    const midTermSummary = conversation?.summary;
    const shortTermMessages = allMessages.slice(-SHORT_TERM_TURNS * 2);

    return {
        shortTermMessages,
        midTermSummary,
        longTermMemory,
    };
}

/**
 * 要約が必要かどうかを判定（クライアントサイド）
 */
export function shouldSummarize(messages: Message[], conversationId: string): boolean {
    const turnCount = messages.filter(m => m.role === 'user').length;
    return turnCount >= SUMMARY_THRESHOLD;
}

/**
 * 要約を生成してDBに保存（クライアントサイド）
 * APIを呼び出して要約を生成する
 */
export async function generateAndSaveSummary(
    conversationId: string,
    messages: Message[]
): Promise<ConversationSummary | null> {
    try {
        const messagesToSummarize = messages.slice(0, -SHORT_TERM_TURNS * 2);
        if (messagesToSummarize.length === 0) return null;

        const conversationHistory = messagesToSummarize
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');

        // 要約APIを呼び出す
        const response = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationHistory }),
        });

        if (!response.ok) {
            console.error('[Context Manager] Summary API failed:', response.status);
            return null;
        }

        const summary = await response.json() as ConversationSummary;
        await updateConversationSummary(conversationId, summary);
        console.log('[Context Manager] Summary saved:', summary.currentState);
        return summary;
    } catch (error) {
        console.error('[Context Manager] Summary generation failed:', error);
        return null;
    }
}

/**
 * 直近のコンテキストを文字列形式で取得（意図分類用）
 */
export function getRecentContext(messages: Message[], count: number = 5): string {
    const recentMessages = messages.slice(-(count * 2));
    return recentMessages
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');
}

// 後方互換のためのエクスポート（サーバーサイドからの呼び出しは何もしない）
export async function checkAndSummarize(
    _conversationId: string,
    _messages: any[]
): Promise<void> {
    // サーバーサイドから呼ばれた場合は何もしない
    // （IndexedDBはブラウザ専用のため）
    if (typeof window === 'undefined') {
        console.warn('[Context Manager] checkAndSummarize called on server side - skipping');
        return;
    }
}
