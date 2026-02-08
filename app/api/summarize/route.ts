/**
 * 要約APIエンドポイント
 * クライアントサイドから呼び出され、会話の要約を生成する
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { CONTEXT_SUMMARY_PROMPT } from '@/prompts/context-summary';

export const maxDuration = 60;

const summarySchema = z.object({
    projectContext: z.string(),
    decisions: z.array(z.string()),
    userPreferences: z.array(z.string()),
    keyInformation: z.array(z.string()),
    currentState: z.string(),
});

export async function POST(req: Request) {
    try {
        const { conversationHistory } = await req.json();

        if (!conversationHistory || typeof conversationHistory !== 'string') {
            return new Response(
                JSON.stringify({ error: 'conversationHistory is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 要約対象テキストが長すぎる場合は切り詰め
        const trimmedHistory = conversationHistory.slice(0, 50000);

        const prompt = CONTEXT_SUMMARY_PROMPT.replace(
            '{conversation_history}',
            trimmedHistory
        );

        const result = await generateObject({
            model: google('gemini-3-flash-preview'),
            schema: summarySchema,
            prompt,
            providerOptions: {
                google: {
                    thinkingConfig: {
                        thinkingLevel: 'low' as const,
                    },
                },
            },
        });

        return new Response(
            JSON.stringify(result.object),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('[Summarize API] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to generate summary' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
