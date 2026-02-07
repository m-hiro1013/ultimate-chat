/**
 * プロンプト動的構築エンジン
 * システムプロンプトをモード・記憶に応じて動的に組み立てる
 */

import { SYSTEM_BASE_PROMPT } from '@/prompts/system-base';
import { TOOL_USAGE_PROMPT } from '@/prompts/tool-usage';
import { MODE_PROMPTS, type ChatMode } from '@/prompts/_index';
import type { ConversationSummary } from '@/types';

/**
 * システムプロンプトを動的に構築する
 * @param params - 構築パラメータ
 * @returns 完成したシステムプロンプト文字列
 */
export function buildSystemPrompt(params: {
    mode: ChatMode;
    longTermMemory?: string;
    midTermSummary?: ConversationSummary | null;
}): string {
    const { mode, longTermMemory, midTermSummary } = params;

    // 基本パーツを組み立て
    const parts: string[] = [
        // 日付プレースホルダーを現在日時に置換
        SYSTEM_BASE_PROMPT.replace('{current_date}', new Date().toISOString()),
        TOOL_USAGE_PROMPT,
        MODE_PROMPTS[mode],
    ];

    // 長期記憶（ユーザー設定）があれば追加
    if (longTermMemory) {
        parts.push(`## ユーザー設定\n${longTermMemory}`);
    }

    // 中期記憶（会話要約）があれば追加
    if (midTermSummary) {
        parts.push(`## これまでの会話コンテキスト
プロジェクト: ${midTermSummary.projectContext}
決定事項: ${midTermSummary.decisions.join(', ')}
現在の状態: ${midTermSummary.currentState}`);
    }

    return parts.join('\n\n');
}
