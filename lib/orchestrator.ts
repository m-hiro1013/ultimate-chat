/**
 * オーケストレーション層
 * 意図分類 → コンテキスト組み立て → プロンプト構築 → streamText の統合フロー
 */

import { streamText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { buildSystemPrompt } from './prompt-builder';
import {
    detectIntent,
    detectModeQuick,
    needsSearchQuick,
    adjustModeForAttachments,
} from './mode-detector';
import { DEEP_RESEARCH_PLANNER_PROMPT } from '@/prompts/deep-research-planner';
import { ERROR_RECOVERY_PROMPT } from '@/prompts/error-recovery';
import type { ChatMode, ThinkingLevel, ResearchPlan, ConversationSummary } from '@/types';

// ─── 定数 ─────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

/**
 * コンテキストウィンドウ管理の定数
 * Gemini 3 Flash: 入力1M、出力64K
 * ただし実用上は120K-150Kトークンを超えると精度が落ちるため、
 * 安全マージンを取って100Kトークン（約400K文字）を上限とする
 */
const MAX_CONTEXT_CHARS = 400000;
const SYSTEM_PROMPT_RESERVE = 10000; // システムプロンプト用に予約する文字数

// ─── 型定義 ─────────────────────────────────────

interface OrchestratorMessage {
    role: 'user' | 'assistant' | 'system';
    content: string; // ユーザー質問テキストのみ（モード判定用）
    parts?: Array<{ type: string;[key: string]: any }>;
}

interface OrchestratorConfig {
    messages: OrchestratorMessage[];
    mode?: ChatMode;
    thinkingLevel?: ThinkingLevel;
    longTermMemory?: string;
    midTermSummary?: ConversationSummary | null;
    useAutoDetect?: boolean;
}

interface OrchestratorResult {
    stream: ReturnType<typeof streamText>;
    detectedMode: ChatMode;
    detectedThinkingLevel: ThinkingLevel;
    researchPlan?: ResearchPlan;
}

// ─── ユーティリティ ─────────────────────────────

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return message.includes('429') ||
            message.includes('503') ||
            message.includes('504') ||
            message.includes('rate limit') ||
            message.includes('timeout') ||
            message.includes('temporarily') ||
            message.includes('resource_exhausted');
    }
    return false;
}

/**
 * メッセージ配列の推定文字数を計算
 */
function estimateMessageChars(messages: OrchestratorMessage[]): number {
    return messages.reduce((sum, m) => {
        const partsLength = m.parts?.reduce((s, p) => {
            if (p.type === 'text') return s + (p.text?.length || 0);
            if (p.type === 'image') return s + 1000; // 画像は概算
            return s;
        }, 0) || 0;
        return sum + partsLength;
    }, 0);
}

/**
 * 添付ファイルの種類を判定
 */
function analyzeAttachments(messages: OrchestratorMessage[]): {
    hasAttachments: boolean;
    hasTextAttachment: boolean;
    hasImageAttachment: boolean;
    hasCodeAttachment: boolean;
} {
    let hasTextAttachment = false;
    let hasImageAttachment = false;
    let hasCodeAttachment = false;

    for (const m of messages) {
        if (!m.parts) continue;
        for (const p of m.parts) {
            if (p.type === 'image') {
                hasImageAttachment = true;
            }
            if (p.type === 'file') {
                // PDF等
                hasTextAttachment = true;
            }
            if (p.type === 'text' && typeof p.text === 'string' && p.text.includes('<attached_file')) {
                hasTextAttachment = true;
                // コードファイルかどうかを拡張子で判定
                const nameMatch = p.text.match(/name="([^"]+)"/);
                if (nameMatch) {
                    const ext = nameMatch[1].split('.').pop()?.toLowerCase();
                    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'rb'].includes(ext || '')) {
                        hasCodeAttachment = true;
                    }
                }
            }
        }
    }

    return {
        hasAttachments: hasTextAttachment || hasImageAttachment || hasCodeAttachment,
        hasTextAttachment,
        hasImageAttachment,
        hasCodeAttachment,
    };
}

/**
 * メッセージをコンテキストウィンドウに収まるように切り詰める
 * 最新のメッセージを優先的に保持する
 */
function trimMessagesToFit(
    messages: OrchestratorMessage[],
    maxChars: number
): OrchestratorMessage[] {
    // 後ろから（最新から）積み上げていく
    const result: OrchestratorMessage[] = [];
    let totalChars = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const msgChars = estimateMessageChars([msg]);

        if (totalChars + msgChars > maxChars) {
            // これ以上入らない場合、最低限最後のユーザーメッセージは含める
            if (result.length === 0) {
                // 最後のメッセージすら入らない場合は切り詰めて追加
                result.unshift(msg);
                console.warn('[Orchestrator] Last message exceeds context limit, sending truncated');
            }
            break;
        }

        result.unshift(msg);
        totalChars += msgChars;
    }

    if (result.length < messages.length) {
        console.log(`[Orchestrator] Trimmed messages: ${messages.length} → ${result.length} (${totalChars} chars)`);
    }

    return result;
}

// ─── リサーチ計画スキーマ ─────────────────────────

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

// ─── メイン関数 ─────────────────────────────────

/**
 * メインオーケストレーション関数
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

    // ─── Step 1: 入力分析 ───

    // 最新のユーザーメッセージテキスト（ファイル内容を含まない）
    const lastUserMessage = messages
        .filter(m => m.role === 'user')
        .pop()?.content || '';

    // 添付ファイルの分析
    const attachmentInfo = analyzeAttachments(messages);

    // 直近コンテキスト（最新5ターン、ファイル内容除外）
    const recentContext = messages.slice(-10)
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');

    console.log('[Orchestrator] Input analysis:', {
        userMessage: lastUserMessage.slice(0, 100),
        attachments: attachmentInfo,
        messageCount: messages.length,
    });

    // ─── Step 2: 意図分類 ───

    let detectedMode: ChatMode = explicitMode || 'general';
    let detectedThinkingLevel: ThinkingLevel = explicitThinkingLevel || 'medium';

    if (useAutoDetect && !explicitMode) {
        // キーワード判定（ユーザーの質問テキストのみ）
        const quickMode = detectModeQuick(lastUserMessage);
        const needsSearch = needsSearchQuick(lastUserMessage);

        // 添付ファイルがある場合のモード調整
        if (attachmentInfo.hasAttachments) {
            const adjusted = adjustModeForAttachments(
                quickMode,
                attachmentInfo.hasTextAttachment,
                attachmentInfo.hasImageAttachment,
                attachmentInfo.hasCodeAttachment,
            );
            detectedMode = adjusted.mode;
            detectedThinkingLevel = adjusted.thinkingLevel;
        } else if (quickMode === 'general' && needsSearch) {
            // 複雑な質問の場合のみAI判定
            try {
                const intent = await detectIntent(lastUserMessage, recentContext);
                detectedMode = intent.mode;
                detectedThinkingLevel = intent.thinkingLevel;
                console.log('[Orchestrator] AI intent:', intent);
            } catch (error) {
                console.error('[Orchestrator] Intent detection failed, using quick detection');
                detectedMode = quickMode;
            }
        } else {
            detectedMode = quickMode;
            detectedThinkingLevel = quickMode === 'research' ? 'high' :
                quickMode === 'coding' ? 'high' : 'medium';
        }
    }

    console.log('[Orchestrator] Mode:', detectedMode, 'ThinkingLevel:', detectedThinkingLevel);

    // ─── Step 3: リサーチ計画（リサーチモード & ファイル添付なしの場合のみ） ───

    let researchPlan: ResearchPlan | undefined;
    let additionalSystemPrompt = '';

    if (detectedMode === 'research' && !attachmentInfo.hasAttachments) {
        try {
            researchPlan = await generateResearchPlanWithRetry(lastUserMessage);
            console.log('[Orchestrator] Research plan generated:', researchPlan.searchQueries.length, 'queries');

            additionalSystemPrompt = `
\n## リサーチ計画
以下の検索戦略を参考に調査を行ってください（必ずしもこの通りでなくてよいですが、網羅性を意識してください）：

### 推奨検索クエリ
${researchPlan.searchQueries.map((q, i) => `${i + 1}. "${q.query}" (${q.language}) - ${q.purpose}`).join('\n')}

### 期待されるソース
${researchPlan.expectedSources}

### 情報が不足した場合
${researchPlan.fallbackStrategy}
`;
        } catch (error) {
            console.error('[Orchestrator] Research planning failed:', error);
            // 計画失敗してもリサーチモード自体は続行
        }
    }

    // 添付ファイル分析の強化プロンプト
    if (attachmentInfo.hasAttachments) {
        additionalSystemPrompt += `
\n## 添付ファイルの解析指示
ユーザーからファイルが提供されています。以下を必ず守ってください：

1. **ファイル内容の確認を最優先すること**: ファイルの中身を実際に読み、その内容に基づいて回答してください。ファイルの中身を読まずに推測で回答することは絶対に禁止です。
2. **内容の引用**: 回答でファイル内の具体的な箇所を引用し、根拠を明確にしてください。
3. **ファイルが読めない場合**: ファイルの内容にアクセスできない場合は、正直に「ファイルの内容を読み取れませんでした」と伝えてください。内容を推測や捏造して回答しないでください。
`;
    }

    // ─── Step 4: システムプロンプト構築 ───

    const systemPrompt = buildSystemPrompt({
        mode: detectedMode,
        longTermMemory,
        midTermSummary,
        hasFileAttachment: attachmentInfo.hasAttachments,
    }) + additionalSystemPrompt;

    // ─── Step 5: メッセージのコンテキストウィンドウ調整 ───

    const availableChars = MAX_CONTEXT_CHARS - systemPrompt.length - SYSTEM_PROMPT_RESERVE;
    const trimmedMessages = trimMessagesToFit(messages, availableChars);

    // ─── Step 6: Gemini パラメータ設定 ───

    const thinkingLevelMap: Record<ThinkingLevel, 'minimal' | 'low' | 'medium' | 'high'> = {
        'minimal': 'minimal',
        'low': 'low',
        'medium': 'medium',
        'high': 'high',
    };
    const geminiThinkingLevel = thinkingLevelMap[detectedThinkingLevel] || 'medium';

    // maxStepsの決定
    let maxSteps: number;
    if (attachmentInfo.hasAttachments) {
        maxSteps = 3; // ファイル分析時は検索を最小限に
    } else if (detectedMode === 'research') {
        maxSteps = 10;
    } else if (detectedMode === 'coding') {
        maxSteps = 5; // 最新バージョン検索用
    } else {
        maxSteps = 3;
    }

    // maxTokensの決定（入力が大きい場合は抑制）
    const inputChars = estimateMessageChars(trimmedMessages);
    const dynamicMaxTokens = inputChars > 200000 ? 16384 : 65536;

    // ─── Step 7: streamText 実行 ───

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = (streamText as any)({
                model: google('gemini-3-flash-preview'),
                system: systemPrompt,
                messages: trimmedMessages as any, // AI SDK v6のメッセージ型に変換
                maxSteps,
                tools: {
                    google_search: google.tools.googleSearch({}),
                    url_context: google.tools.urlContext({}),
                },
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingLevel: geminiThinkingLevel,
                        },
                        maxTokens: dynamicMaxTokens,
                        ...(attachmentInfo.hasImageAttachment && {
                            mediaResolution: 'MEDIA_RESOLUTION_HIGH',
                        }),
                    } as any,
                },
                onStepFinish({ finishReason, usage }: any) {
                    console.log('[Step]', { finishReason, usage });
                },
                onError({ error }: any) {
                    console.error('[StreamText Error]', error);
                },
            });

            return {
                stream: result,
                detectedMode,
                detectedThinkingLevel,
                researchPlan,
            } as any;
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

    // ─── フォールバック ───

    console.error('[Orchestrator] All retries failed, using fallback');

    const fallbackResult = (streamText as any)({
        model: google('gemini-3-flash-preview'),
        system: systemPrompt + '\n\n' + ERROR_RECOVERY_PROMPT,
        messages: trimmedMessages as any,
        providerOptions: {
            google: {
                thinkingConfig: {
                    thinkingLevel: 'minimal' as const,
                },
                maxTokens: 16384,
            } as any,
        },
        onStepFinish({ finishReason, usage }: any) {
            console.log('[Fallback Step]', { finishReason, usage });
        },
    });

    return {
        stream: fallbackResult,
        detectedMode,
        detectedThinkingLevel,
        researchPlan,
    } as any;
}

/**
 * リトライ付きリサーチ計画生成
 */
async function generateResearchPlanWithRetry(userQuestion: string): Promise<ResearchPlan> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) { // リサーチ計画は2回まで
        try {
            const prompt = DEEP_RESEARCH_PLANNER_PROMPT.replace(
                '{user_question}',
                userQuestion.slice(0, 2000), // 質問テキストを制限
            );

            const result = await generateObject({
                model: google('gemini-3-flash-preview'),
                schema: researchPlanSchema,
                prompt,
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingLevel: 'low' as const,
                        },
                    },
                },
            });

            return result.object as ResearchPlan;
        } catch (error) {
            lastError = error;
            console.error(`[Research Plan] Attempt ${attempt + 1} failed:`, error);
            if (isRetryableError(error) && attempt < 1) {
                await sleep(RETRY_DELAY_BASE * Math.pow(2, attempt));
            } else {
                break;
            }
        }
    }

    throw lastError;
}
