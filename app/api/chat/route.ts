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

        // バリデーション（9.2対応）
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
            conversationId,
            mode,
            thinkingLevel,
            longTermMemory,
            midTermSummary,
        } = parseResult.data;

        console.log('[Chat API] Received request:', {
            conversationId,
            mode,
            thinkingLevel,
            messageCount: messages?.length
        });

        // partsベースのメッセージを保持しつつ、要約用にテキスト抽出
        // (3.10/5.6: Thought Signatures保持 & 1.4/6.1-6.3: マルチモーダル対応)
        const preservedMessages = messages.map((m) => {
            const textParts = m.parts?.filter((p: any) => p.type === 'text') ?? [];
            const content = textParts.map((p: any) => p.text ?? '').join('');
            return {
                id: m.id,
                role: m.role as 'user' | 'assistant' | 'system',
                content,
                parts: m.parts,
            };
        });

        console.log('[Chat API] Calling orchestrator...');

        // バックグラウンドで要約チェック（レスポンスをブロックしない）
        if (conversationId) {
            const simpleMessages = preservedMessages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
            }));
            checkAndSummarize(conversationId, simpleMessages).catch(err =>
                console.error('[Chat API] checkAndSummarize failed:', err)
            );
        }

        // オーケストレーション層を呼び出し
        const result = await orchestrate({
            messages: preservedMessages,
            mode: mode === 'auto' ? undefined : (mode || undefined),
            thinkingLevel: thinkingLevel || undefined,
            longTermMemory,
            midTermSummary,
            useAutoDetect: !mode || mode === 'auto',
        });

        console.log('[Chat API] Orchestration result:', {
            detectedMode: result.detectedMode,
            detectedThinkingLevel: result.detectedThinkingLevel,
            hasResearchPlan: !!result.researchPlan,
        });

        // AI SDK v6: toUIMessageStreamResponse() を使用
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
