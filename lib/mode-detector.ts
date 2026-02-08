/**
 * 意図分類（Mode Detection）
 * ユーザーのメッセージを分析し、最適なモードとツール設定を決定する
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { INTENT_CLASSIFICATION_PROMPT } from '@/prompts/intent-classification';
import type { IntentClassification, ChatMode, ThinkingLevel } from '@/types';

const intentSchema = z.object({
    mode: z.enum(['general', 'research', 'coding']),
    needsSearch: z.boolean(),
    needsUrlContext: z.boolean(),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']),
    reasoning: z.string(),
});

/**
 * ユーザーメッセージの意図をAI判定する
 */
export async function detectIntent(
    userMessage: string,
    recentContext?: string
): Promise<IntentClassification> {
    try {
        const prompt = INTENT_CLASSIFICATION_PROMPT
            .replace('{user_message}', userMessage.slice(0, 1000)) // 長すぎるメッセージを切り詰め
            .replace('{recent_context}', recentContext?.slice(0, 2000) || 'なし');

        const result = await generateObject({
            model: google('gemini-3-flash-preview'),
            schema: intentSchema,
            prompt,
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingLevel: 'minimal',
                    },
                },
            },
        });

        return result.object as IntentClassification;
    } catch (error) {
        console.error('[Mode Detection Error]', error);
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
 * ユーザーの質問テキストのみを入力すること（ファイル内容を含めない）
 */
export function detectModeQuick(message: string): ChatMode {
    const lowerMessage = message.toLowerCase();

    // URLが含まれている場合はリサーチ寄り
    const hasUrl = /https?:\/\/\S+/.test(message);

    // コーディングモードのキーワード
    // 注意: 「コード」単体は「このコードを見て」のような分析依頼にも使われるため、
    //        動詞と組み合わせて判定する
    const codingPatterns = [
        /コード.*(書|作|生成|実装)/,
        /実装して/,
        /(作って|作成して).*(アプリ|コンポーネント|関数|API|ページ|サイト)/,
        /バグ.*(修正|直|fix)/,
        /エラー.*(修正|直|fix|解決)/,
        /デバッグ/,
        /リファクタ/,
        /(テスト|test).*(書|作|追加)/,
        /npm |pnpm |yarn |pip |cargo /,
        /import .+ from/,
        /function |const |let |var |class |interface |type /,
        /```\w/,  // コードブロックが含まれている
    ];

    const codingKeywordsExact = [
        'typescript', 'javascript', 'python', 'react', 'next.js', 'vue',
        'angular', 'node.js', 'express', 'fastapi', 'django', 'flask',
        'rust', 'go', 'swift', 'kotlin',
    ];

    // リサーチモードのキーワード
    const researchPatterns = [
        /調べて/,
        /教えて/,
        /調査/,
        /最新.*(情報|動向|ニュース|状況)/,
        /比較して/,
        /どっちがいい/,
        /おすすめ/,
        /違い.*(は|を|って)/,
        /メリット|デメリット/,
        /深掘り/,
        /徹底的/,
        /詳しく/,
        /まとめて/,
        /^.{0,10}(とは|って何|ってなに)/,  // 「〇〇とは」形式
    ];

    const researchKeywordsExact = [
        'research', 'compare', 'latest', 'news', 'benchmark',
    ];

    // パターンマッチング（正規表現）
    if (codingPatterns.some(pattern => pattern.test(lowerMessage))) {
        return 'coding';
    }

    // 完全キーワードマッチ（コーディング）
    // 単にファイル内にキーワードがあるだけでは反応しないよう、
    // ユーザーの質問テキストにフォーカス
    const words = lowerMessage.split(/\s+/);
    if (codingKeywordsExact.some(kw => words.includes(kw))) {
        return 'coding';
    }

    // パターンマッチング（リサーチ）
    if (researchPatterns.some(pattern => pattern.test(lowerMessage))) {
        return 'research';
    }

    if (researchKeywordsExact.some(kw => words.includes(kw))) {
        return 'research';
    }

    // URLが含まれていればリサーチ寄り
    if (hasUrl) {
        return 'research';
    }

    return 'general';
}

/**
 * 検索が必要かどうかを簡易判定
 */
export function needsSearchQuick(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    const searchPatterns = [
        /最新/,
        /現在/,
        /今日/,
        /2025|2026/,
        /調べて/,
        /検索/,
        /ニュース/,
        /バージョン/,
        /リリース/,
        /いつ(から|まで|頃|ごろ)/,
        /価格|値段|料金/,
        /天気/,
        /株価/,
        /^.{0,5}(誰|何|いつ|どこ|なぜ|どうやって)/,
    ];

    return searchPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * 添付ファイルがある場合のモード調整
 */
export function adjustModeForAttachments(
    detectedMode: ChatMode,
    hasTextAttachment: boolean,
    hasImageAttachment: boolean,
    hasCodeAttachment: boolean,
): { mode: ChatMode; thinkingLevel: ThinkingLevel } {
    // コードファイルが添付されていて、質問がコーディング関連ならコーディングモード維持
    if (hasCodeAttachment && detectedMode === 'coding') {
        return { mode: 'coding', thinkingLevel: 'high' };
    }

    // ファイル添付があり、質問がリサーチモードでも、
    // ファイル分析が主目的の可能性が高いのでgeneralに
    if ((hasTextAttachment || hasImageAttachment) && detectedMode === 'research') {
        return { mode: 'general', thinkingLevel: 'medium' };
    }

    // 画像添付はmediumで十分
    if (hasImageAttachment && detectedMode === 'general') {
        return { mode: 'general', thinkingLevel: 'medium' };
    }

    // テキストファイル添付はmedium〜high
    if (hasTextAttachment) {
        return { mode: detectedMode, thinkingLevel: 'medium' };
    }

    return {
        mode: detectedMode,
        thinkingLevel: detectedMode === 'research' ? 'high' : 'medium',
    };
}
