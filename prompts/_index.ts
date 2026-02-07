/**
 * ★ プロンプトインデックス（辞書）
 *
 * 全プロンプトの参照箇所・内容・使用タイミングを一元管理する。
 * プロンプトを編集・追加する場合は、このファイルも必ず更新すること。
 */

import { SYSTEM_BASE_PROMPT } from './system-base';
import { TOOL_USAGE_PROMPT } from './tool-usage';
import { MODE_GENERAL_PROMPT } from './mode-general';
import { MODE_RESEARCH_PROMPT } from './mode-research';
import { MODE_CODING_PROMPT } from './mode-coding';
import { FILE_ANALYSIS_PROMPT } from './file-analysis';
import { CONTEXT_SUMMARY_PROMPT } from './context-summary';
import { QUALITY_CHECK_PROMPT } from './quality-check';
import { ERROR_RECOVERY_PROMPT } from './error-recovery';
import { INTENT_CLASSIFICATION_PROMPT } from './intent-classification';
import { DEEP_RESEARCH_PLANNER_PROMPT } from './deep-research-planner';

/**
 * プロンプトレジストリ
 * 各プロンプトのメタ情報と実体を保持
 */
export const PROMPT_REGISTRY = {
    'system-base': {
        file: 'prompts/system-base.ts',
        description: 'AIの基本人格、言語設定、回答スタイル、誠実さのルール',
        usedIn: 'すべてのリクエストに必ず付与',
        prompt: SYSTEM_BASE_PROMPT,
    },
    'tool-usage': {
        file: 'prompts/tool-usage.ts',
        description: 'Google Search / URL Context の使用判断基準とルール',
        usedIn: 'すべてのリクエストにsystem-baseと結合して付与',
        prompt: TOOL_USAGE_PROMPT,
    },
    'mode-general': {
        file: 'prompts/mode-general.ts',
        description: 'デフォルトの一般会話モード。質問の複雑さに応じて回答調整',
        usedIn: 'モード判定が「一般」の場合',
        prompt: MODE_GENERAL_PROMPT,
    },
    'mode-research': {
        file: 'prompts/mode-research.ts',
        description: 'リサーチ特化。複数ソース統合、網羅性重視、出典明記',
        usedIn: 'モード判定が「リサーチ」の場合',
        prompt: MODE_RESEARCH_PROMPT,
    },
    'mode-coding': {
        file: 'prompts/mode-coding.ts',
        description: 'コーディング特化。完全動作コード、ファイルパス明記、最新バージョン確認',
        usedIn: 'モード判定が「コーディング」の場合',
        prompt: MODE_CODING_PROMPT,
    },
    'file-analysis': {
        file: 'prompts/file-analysis.ts',
        description: 'ファイル添付時のコンテキスト付与テンプレート',
        usedIn: 'ユーザーがファイルを添付した場合に、メッセージ前に注入',
        prompt: FILE_ANALYSIS_PROMPT,
    },
    'context-summary': {
        file: 'prompts/context-summary.ts',
        description: '古い会話履歴を要約して中期記憶に変換するための指示',
        usedIn: '会話が20ターンを超えた場合にバックグラウンドで実行',
        prompt: CONTEXT_SUMMARY_PROMPT,
    },
    'quality-check': {
        file: 'prompts/quality-check.ts',
        description: '生成された回答の品質を自己評価し、不足があれば追加検索を指示',
        usedIn: 'リサーチモードの最終ステップで実行',
        prompt: QUALITY_CHECK_PROMPT,
    },
    'error-recovery': {
        file: 'prompts/error-recovery.ts',
        description: '検索ツール障害時のフォールバック回答ルール',
        usedIn: 'Google Search / URL Context がエラーを返した場合',
        prompt: ERROR_RECOVERY_PROMPT,
    },
    'intent-classification': {
        file: 'prompts/intent-classification.ts',
        description: 'ユーザーの質問意図を分類し、最適なモードとツールを決定',
        usedIn: 'オーケストレーション層の最初のステップで実行',
        prompt: INTENT_CLASSIFICATION_PROMPT,
    },
    'deep-research-planner': {
        file: 'prompts/deep-research-planner.ts',
        description: 'リサーチ時に検索戦略（クエリ複数生成、深掘り判定）を立案',
        usedIn: 'リサーチモードでmulti-step tool callingの前に実行',
        prompt: DEEP_RESEARCH_PLANNER_PROMPT,
    },
} as const;

/** 全プロンプトをID指定で取得 */
export function getPrompt(id: keyof typeof PROMPT_REGISTRY): string {
    return PROMPT_REGISTRY[id].prompt;
}

/** モード名からモードプロンプトを取得 */
export const MODE_PROMPTS = {
    general: MODE_GENERAL_PROMPT,
    research: MODE_RESEARCH_PROMPT,
    coding: MODE_CODING_PROMPT,
} as const;

export type ChatMode = keyof typeof MODE_PROMPTS;
