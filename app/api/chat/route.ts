/**
 * メインAPIルート
 * オーケストレーション層を使用してGemini 3 Flashと通信
 */

import { orchestrate } from '@/lib/orchestrator';
import { checkAndSummarize } from '@/lib/context-manager';
import { z } from 'zod';
import type { ChatMode, ThinkingLevel, ConversationSummary } from '@/types';

// 長いリサーチに備えて60秒に設定
export const maxDuration = 60;

// リクエストボディのバリデーションスキーマ（9.2対応）
const chatRequestSchema = z.object({
    messages: z.array(z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant', 'system']),
        parts: z.array(z.object({
            type: z.string(),
        }).passthrough()).default([]),
    })).max(100), // 最大100メッセージ
    conversationId: z.string().optional(),
    mode: z.enum(['auto', 'general', 'research', 'coding']).optional(),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
    longTermMemory: z.string().max(10000).optional(),
    midTermSummary: z.any().optional(),
});

/**
 * POSTリクエストハンドラ
 * オーケストレーション層を通してストリーミングレスポンスを返す
 */
export async function POST(req: Request) {
    try {
        const rawBody = await req.json();

        const parseResult = chatRequestSchema.safeParse(rawBody);
        if (!parseResult.success) {
            console.error('[Chat API] Validation failed:', parseResult.error.issues);
            return new Response(
                JSON.stringify({
                    error: 'Invalid request body',
                    details: parseResult.error.issues,
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const {
            messages,
            mode,
            thinkingLevel,
            longTermMemory,
            midTermSummary,
        } = parseResult.data;

        console.log('[Chat API] Received:', {
            mode,
            thinkingLevel,
            messageCount: messages?.length,
            hasLongTermMemory: !!longTermMemory,
            hasMidTermSummary: !!midTermSummary,
        });

        // メッセージを処理
        // content にはユーザーの質問テキストのみを入れる（ファイル内容除外）
        const preservedMessages = messages.map((m) => {
            const textParts = m.parts?.filter((p: any) => p.type === 'text') ?? [];
            const userQuestionText = textParts
                .map((p: any) => p.text ?? '')
                .filter((text: string) => !text.includes('<attached_file'))
                .join('')
                .trim();

            return {
                id: m.id,
                role: m.role as 'user' | 'assistant' | 'system',
                content: userQuestionText,
                parts: m.parts,
            };
        });

        // オーケストレーション実行
        const result = await orchestrate({
            messages: preservedMessages,
            mode: mode === 'auto' ? undefined : (mode || undefined),
            thinkingLevel: thinkingLevel || undefined,
            longTermMemory,
            midTermSummary: midTermSummary || undefined,
            useAutoDetect: !mode || mode === 'auto',
        });

        console.log('[Chat API] Result:', {
            detectedMode: result.detectedMode,
            detectedThinkingLevel: result.detectedThinkingLevel,
            hasResearchPlan: !!result.researchPlan,
        });

        return result.stream.toUIMessageStreamResponse({
            sendSources: true,
        });
    } catch (error) {
        console.error('[Chat API Error]', error);
        if (error instanceof SyntaxError) {
            return new Response(
                JSON.stringify({ error: 'Invalid JSON' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
        return new Response(
            JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
