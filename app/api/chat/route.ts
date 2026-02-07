/**
 * メインAPIルート
 * オーケストレーション層を使用してGemini 3 Flashと通信
 */

import { orchestrate } from '@/lib/orchestrator';
import type { ChatMode, ThinkingLevel, ConversationSummary } from '@/types';

// 長いリサーチに備えて60秒に設定
export const maxDuration = 60;

// リクエストボディの型定義
interface ChatRequestBody {
    messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        parts: Array<{ type: string; text?: string }>;
    }>;
    mode?: ChatMode;
    thinkingLevel?: ThinkingLevel;
    longTermMemory?: string;
    midTermSummary?: ConversationSummary | null;
}

/**
 * POSTリクエストハンドラ
 * オーケストレーション層を通してストリーミングレスポンスを返す
 */
export async function POST(req: Request) {
    try {
        const body: ChatRequestBody = await req.json();
        const {
            messages,
            mode,
            thinkingLevel,
            longTermMemory,
            midTermSummary,
        } = body;

        console.log('[Chat API] Received request:', {
            mode,
            thinkingLevel,
            messageCount: messages?.length
        });

        // partsベースのメッセージをシンプルな形式に変換
        const simpleMessages = messages.map((m) => {
            const textParts = m.parts?.filter((p) => p.type === 'text') ?? [];
            const content = textParts.map((p) => p.text ?? '').join('');
            return {
                role: m.role as 'user' | 'assistant' | 'system',
                content,
            };
        });

        console.log('[Chat API] Calling orchestrator...');

        // オーケストレーション層を呼び出し
        const result = await orchestrate({
            messages: simpleMessages,
            mode: mode || undefined,  // undefinedなら自動検出
            thinkingLevel: thinkingLevel || undefined,
            longTermMemory,
            midTermSummary,
            useAutoDetect: !mode,  // モードが指定されていなければ自動検出
        });

        console.log('[Chat API] Orchestration result:', {
            detectedMode: result.detectedMode,
            detectedThinkingLevel: result.detectedThinkingLevel,
            hasResearchPlan: !!result.researchPlan,
        });

        // AI SDK v6: toUIMessageStreamResponse() を使用
        return result.stream.toUIMessageStreamResponse();
    } catch (error) {
        console.error('[Chat API Error]', error);
        return new Response(
            JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
