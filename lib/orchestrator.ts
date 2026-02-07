/**
 * オーケストレーション層
 * 意図分類→プロンプト構築→streamTextの統合フロー
 * エラーリカバリー、リトライロジックを含む
 */

import { streamText, generateObject, stepCountIs } from 'ai';
import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { z } from 'zod';
import { buildSystemPrompt } from './prompt-builder';
import { detectIntent, detectModeQuick, needsSearchQuick } from './mode-detector';
import { DEEP_RESEARCH_PLANNER_PROMPT } from '@/prompts/deep-research-planner';
import { ERROR_RECOVERY_PROMPT } from '@/prompts/error-recovery';
import type { ChatMode, ThinkingLevel, ResearchPlan, ConversationSummary } from '@/types';

/**
 * リサーチ計画のスキーマ
 */
const researchPlanSchema = z.object({
    searchQueries: z.array(z.object({
        query: z.string(),
        purpose: z.string(),
        language: z.enum(['en', 'ja']),
    })),
    urlsToAnalyze: z.array(z.string()),
    expectedSources: z.string(),
    fallbackStrategy: z.string(),
});

/**
 * オーケストレーション設定
 */
interface OrchestratorConfig {
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
        parts?: Array<{ type: string;[key: string]: any }>;
    }>;
    mode?: ChatMode;
    thinkingLevel?: ThinkingLevel;
    longTermMemory?: string;
    midTermSummary?: ConversationSummary | null;
    useAutoDetect?: boolean;
}

/**
 * オーケストレーション結果
 */
interface OrchestratorResult {
    stream: any;
    detectedMode: ChatMode;
    detectedThinkingLevel: ThinkingLevel;
    researchPlan?: ResearchPlan;
}

// リプライ設定
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1秒

/**
 * 指数バックオフでスリープ
 */
async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * リトライ可能なエラーかどうかを判定
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // 429 (Rate Limit), 503 (Service Unavailable), 504 (Gateway Timeout)
        return message.includes('429') ||
            message.includes('503') ||
            message.includes('504') ||
            message.includes('rate limit') ||
            message.includes('timeout') ||
            message.includes('temporarily');
    }
    return false;
}

/**
 * メインオーケストレーション関数
 * 意図分類→プロンプト構築→streamText実行を統合
 */
export async function orchestrate(config: OrchestratorConfig): Promise<OrchestratorResult> {
    const {
        messages,
        mode: explicitMode,
        thinkingLevel: explicitThinkingLevel,
        longTermMemory,
        midTermSummary,
        useAutoDetect = true,
    } = config;

    // 最新のユーザーメッセージを取得
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    // 直近のコンテキストを構築（最新5ターン）
    const recentContext = messages.slice(-10)
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');

    // ステップ1: 意図分類（明示的なモードがない場合）
    let detectedMode: ChatMode = explicitMode || 'general';
    let detectedThinkingLevel: ThinkingLevel = explicitThinkingLevel || 'medium';

    if (useAutoDetect && !explicitMode) {
        // 高速判定（キーワードベース）を先に試行
        const quickMode = detectModeQuick(lastUserMessage);
        const needsSearch = needsSearchQuick(lastUserMessage);

        // 複雑な質問の場合のみAI判定を使用
        if (quickMode === 'general' && needsSearch) {
            try {
                const intent = await detectIntent(lastUserMessage, recentContext);
                detectedMode = intent.mode;
                detectedThinkingLevel = intent.thinkingLevel;
                console.log('[Orchestrator] Intent detected:', intent);
            } catch (error) {
                console.error('[Orchestrator] Intent detection failed, using quick detection');
                detectedMode = quickMode;
            }
        } else {
            detectedMode = quickMode;
            detectedThinkingLevel = quickMode === 'research' ? 'high' : 'medium';
        }
    }

    console.log('[Orchestrator] Mode:', detectedMode, 'ThinkingLevel:', detectedThinkingLevel);

    // ステップ2: リサーチモードの場合、リサーチ計画を立てる
    let researchPlan: ResearchPlan | undefined;
    let additionalSystemPrompt = '';

    if (detectedMode === 'research') {
        try {
            researchPlan = await generateResearchPlanWithRetry(lastUserMessage);
            console.log('[Orchestrator] Research plan:', researchPlan);

            // リサーチ計画をシステムプロンプトに注入
            additionalSystemPrompt = `
\n## リサーチ計画
以下の検索戦略に基づいて調査を行ってください：

### 検索クエリ
${researchPlan.searchQueries.map((q, i) => `${i + 1}. "${q.query}" (${q.language}) - ${q.purpose}`).join('\n')}

### 期待されるソース
${researchPlan.expectedSources}

### フォールバック戦略
${researchPlan.fallbackStrategy}
`;
        } catch (error) {
            console.error('[Orchestrator] Research planning failed:', error);
            // エラーリカバリー: プロンプトに通知を追加
            additionalSystemPrompt = '\n\n' + ERROR_RECOVERY_PROMPT;
        }
    }

    // ステップ3: システムプロンプト構築
    const systemPrompt = buildSystemPrompt({
        mode: detectedMode,
        longTermMemory,
        midTermSummary,
    }) + additionalSystemPrompt;

    // ステップ4: thinkingLevelをGemini 3形式に変換
    const thinkingLevelMap: Record<ThinkingLevel, 'minimal' | 'low' | 'medium' | 'high'> = {
        'minimal': 'minimal',
        'low': 'low',
        'medium': 'medium',
        'high': 'high',
    };
    const geminiThinkingLevel = thinkingLevelMap[detectedThinkingLevel] || 'medium';

    // ステップ5: streamText実行（エラーハンドリング付き）
    let stream: ReturnType<typeof streamText>;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            stream = streamText({
                model: google('gemini-3-flash-preview'),
                system: systemPrompt,
                messages: messages as any,
                maxSteps: detectedMode === 'research' ? 10 : 3, // AI SDK v6 replacement for manual step management
                temperature: 1.0,
                tools: {
                    google_search: google.tools.googleSearch({}),
                    url_context: google.tools.urlContext({}),
                },
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingLevel: geminiThinkingLevel,
                        },
                    } satisfies GoogleGenerativeAIProviderOptions,
                },
                onStepFinish({ finishReason, usage }) {
                    console.log('[Step]', { finishReason, usage });
                },
                onFinish: async ({ text }) => {
                    // リサーチモードの場合、品質チェックを実行（非同期）
                    if (detectedMode === 'research') {
                        try {
                            const { QUALITY_CHECK_PROMPT } = await import('@/prompts/quality-check');
                            const qualityResult = await generateObject({
                                model: google('gemini-3-flash-preview'),
                                schema: z.object({
                                    accuracy: z.object({ score: z.number(), issues: z.array(z.string()) }),
                                    completeness: z.object({ score: z.number(), gaps: z.array(z.string()) }),
                                    usefulness: z.object({ score: z.number(), improvements: z.array(z.string()) }),
                                    overallScore: z.number(),
                                    needsAdditionalSearch: z.boolean(),
                                    additionalSearchQueries: z.array(z.string()),
                                }),
                                prompt: QUALITY_CHECK_PROMPT
                                    .replace('{question}', lastUserMessage)
                                    .replace('{answer}', text),
                                providerOptions: {
                                    google: {
                                        thinkingConfig: {
                                            thinkingLevel: 'low',
                                        },
                                    },
                                },
                            });
                            console.log('[Quality Check] Result:', qualityResult.object);
                        } catch (error) {
                            console.error('[Quality Check] Failed:', error);
                        }
                    }
                },
                onError({ error }) {
                    console.error('[StreamText Error]', error);
                },
            });

            // streamが正常に作成されたらループを抜ける
            return {
                stream,
                detectedMode,
                detectedThinkingLevel,
                researchPlan,
            };
        } catch (error) {
            lastError = error;
            console.error(`[Orchestrator] Attempt ${attempt + 1} failed:`, error);

            if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
                const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
                console.log(`[Orchestrator] Retrying in ${delay}ms...`);
                await sleep(delay);
            } else {
                break;
            }
        }
    }

    // 全リトライ失敗時: フォールバック
    console.error('[Orchestrator] All retries failed, using fallback');

    // エラーリカバリーモード: 検索なしで回答
    stream = streamText({
        model: google('gemini-3-flash-preview'),
        system: systemPrompt + '\n\n' + ERROR_RECOVERY_PROMPT,
        messages: messages as any,
        maxTokens: 65536, // ← 追加
        temperature: 1.0,  // ← 追加
        // ツールなしでフォールバック、thinkingはminimalで高速化
        providerOptions: {
            google: {
                thinkingConfig: {
                    thinkingLevel: 'minimal',
                },
            } satisfies GoogleGenerativeAIProviderOptions,
        },
        onStepFinish({ finishReason, usage }) {
            console.log('[Fallback Step]', { finishReason, usage });
        },
    });

    return {
        stream,
        detectedMode,
        detectedThinkingLevel,
        researchPlan,
    };
}

/**
 * リトライ付きリサーチ計画生成
 */
async function generateResearchPlanWithRetry(userQuestion: string): Promise<ResearchPlan> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const prompt = DEEP_RESEARCH_PLANNER_PROMPT.replace('{user_question}', userQuestion);

            const result = await generateObject({
                model: google('gemini-3-flash-preview'),
                schema: researchPlanSchema,
                prompt,
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingLevel: 'low',
                        },
                    },
                },
            });

            return result.object as ResearchPlan;
        } catch (error) {
            lastError = error;
            console.error(`[Research Plan] Attempt ${attempt + 1} failed:`, error);

            if (isRetryableError(error) && attempt < MAX_RETRIES - 1) {
                const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
                await sleep(delay);
            } else {
                break;
            }
        }
    }

    throw lastError;
}
