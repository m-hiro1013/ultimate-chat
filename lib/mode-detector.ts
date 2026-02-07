/**
 * 意図分類（Mode Detection）
 * ユーザーのメッセージを分析し、最適なモードとツール設定を決定する
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { INTENT_CLASSIFICATION_PROMPT } from '@/prompts/intent-classification';
import type { IntentClassification, ChatMode, ThinkingLevel } from '@/types';

/**
 * 意図分類のスキーマ（Zodで定義）
 */
const intentSchema = z.object({
    mode: z.enum(['general', 'research', 'coding']),
    needsSearch: z.boolean(),
    needsUrlContext: z.boolean(),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']),
    reasoning: z.string(),
});

/**
 * ユーザーメッセージの意図を分類する
 * @param userMessage - ユーザーの最新メッセージ
 * @param recentContext - 直近の会話コンテキスト（オプション）
 * @returns 意図分類結果
 */
export async function detectIntent(
    userMessage: string,
    recentContext?: string
): Promise<IntentClassification> {
    try {
        // プロンプトを構築
        const prompt = INTENT_CLASSIFICATION_PROMPT
            .replace('{user_message}', userMessage)
            .replace('{recent_context}', recentContext || 'なし');

        // Gemini 3 Flashで高速に意図分類（thinkingLevel: minimal）
        const result = await generateObject({
            model: google('gemini-2.0-flash'),
            schema: intentSchema,
            prompt,
        });

        return result.object as IntentClassification;
    } catch (error) {
        console.error('[Mode Detection Error]', error);

        // フォールバック: デフォルト設定を返す
        return {
            mode: 'general',
            needsSearch: false,
            needsUrlContext: false,
            thinkingLevel: 'medium',
            reasoning: 'Intent classification failed, using default settings',
        };
    }
}

/**
 * メッセージからモードを簡易判定（キーワードベース）
 * generateObjectを呼ばずに高速に判定したい場合に使用
 */
export function detectModeQuick(message: string): ChatMode {
    const lowerMessage = message.toLowerCase();

    // コーディングモードのキーワード
    const codingKeywords = [
        'コード', 'code', '実装', 'implement', '作って', '書いて',
        'プログラム', 'program', '関数', 'function', 'バグ', 'bug',
        'エラー', 'error', 'デバッグ', 'debug', 'typescript', 'javascript',
        'python', 'react', 'next.js', 'api', 'npm', 'pnpm',
    ];

    // リサーチモードのキーワード
    const researchKeywords = [
        '調べて', '教えて', '調査', 'research', '最新', 'latest',
        '比較', 'compare', 'どっちがいい', 'おすすめ', 'recommendation',
        'ニュース', 'news', '情報', 'information', 'について',
        '違い', 'difference', 'メリット', 'デメリット',
    ];

    // キーワードマッチング
    if (codingKeywords.some(kw => lowerMessage.includes(kw))) {
        return 'coding';
    }
    if (researchKeywords.some(kw => lowerMessage.includes(kw))) {
        return 'research';
    }

    return 'general';
}

/**
 * 検索が必要かどうかを簡易判定
 */
export function needsSearchQuick(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    const searchKeywords = [
        '最新', 'latest', '現在', 'current', '今日', 'today',
        '調べて', 'search', '検索', 'ニュース', 'news',
        '2025', '2026', 'いつ', 'when', 'どこ', 'where',
        'バージョン', 'version', 'リリース', 'release',
    ];

    return searchKeywords.some(kw => lowerMessage.includes(kw));
}
