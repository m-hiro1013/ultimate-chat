/**
 * コンテキスト管理
 * 短期/中期/長期のコンテキストを統合管理
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { CONTEXT_SUMMARY_PROMPT } from '@/prompts/context-summary';
import { getConversation, updateConversationSummary } from './db/conversations';
import { getLongTermMemoryString } from './db/preferences';
import type { Message, ConversationSummary } from '@/types';

// 会話要約のスキーマ
const summarySchema = z.object({
    projectContext: z.string(),
    decisions: z.array(z.string()),
    userPreferences: z.array(z.string()),
    keyInformation: z.array(z.string()),
    currentState: z.string(),
});

// 要約が必要になるターン数の閾値
const SUMMARY_THRESHOLD = 20;

// 短期記憶に保持するターン数
const SHORT_TERM_TURNS = 20;

/**
 * 会話のコンテキストを統合して取得
 * @param conversationId - 会話ID
 * @param allMessages - 全メッセージ
 * @returns 統合されたコンテキスト
 */
export async function getIntegratedContext(
    conversationId: string,
    allMessages: Message[]
): Promise<{
    shortTermMessages: Message[];
    midTermSummary: ConversationSummary | undefined;
    longTermMemory: string;
}> {
    // 長期記憶（ユーザー設定）を取得
    const longTermMemory = await getLongTermMemoryString();

    // 会話を取得して中期記憶（要約）を確認
    const conversation = await getConversation(conversationId);
    const midTermSummary = conversation?.summary;

    // 短期記憶（直近のメッセージ）を取得
    const shortTermMessages = allMessages.slice(-SHORT_TERM_TURNS * 2); // 各ターンは2メッセージ

    return {
        shortTermMessages,
        midTermSummary,
        longTermMemory,
    };
}

/**
 * 会話が長くなったら要約を生成
 * @param conversationId - 会話ID
 * @param messages - 全メッセージ
 */
export async function checkAndSummarize(
    conversationId: string,
    messages: Message[]
): Promise<void> {
    // ターン数を計算（ユーザーメッセージの数）
    const turnCount = messages.filter(m => m.role === 'user').length;

    // 閾値未満なら何もしない
    if (turnCount < SUMMARY_THRESHOLD) {
        return;
    }

    // 既存の要約を確認
    const conversation = await getConversation(conversationId);
    if (!conversation) return;

    // 前回の要約時点からのターン数を確認
    const lastSummaryTurn = conversation.summary ?
        Math.floor(messages.indexOf(messages[0]) / 2) : 0;

    // 10ターンごとに再要約
    if (turnCount - lastSummaryTurn < 10 && conversation.summary) {
        return;
    }

    console.log('[Context Manager] Summarizing conversation...', { turnCount });

    try {
        // 古いメッセージを要約対象にする
        const messagesToSummarize = messages.slice(0, -SHORT_TERM_TURNS * 2);

        if (messagesToSummarize.length === 0) {
            return;
        }

        // 会話履歴を文字列に変換
        const conversationHistory = messagesToSummarize
            .map(m => `${m.role}: ${m.content}`)
            .join('\n\n');

        // 要約を生成
        const prompt = CONTEXT_SUMMARY_PROMPT.replace('{conversation_history}', conversationHistory);

        const result = await generateObject({
            model: google('gemini-2.0-flash'),
            schema: summarySchema,
            prompt,
        });

        const summary = result.object as ConversationSummary;

        // 要約を保存
        await updateConversationSummary(conversationId, summary);

        console.log('[Context Manager] Summary saved:', summary.currentState);
    } catch (error) {
        console.error('[Context Manager] Summary generation failed:', error);
    }
}

/**
 * 直近のコンテキストを文字列形式で取得（意図分類用）
 * @param messages - メッセージ配列
 * @param count - 取得するターン数
 * @returns コンテキスト文字列
 */
export function getRecentContext(messages: Message[], count: number = 5): string {
    const recentMessages = messages.slice(-(count * 2));
    return recentMessages
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');
}
