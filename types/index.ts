/**
 * 全型定義
 * ultimate-chatアプリケーションで使用する型の一元管理
 */

// チャットモードの型
export type ChatMode = 'general' | 'research' | 'coding';

// 思考レベルの型
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/**
 * 意図分類の結果
 * オーケストレーション層の最初のステップで生成される
 */
export interface IntentClassification {
    mode: ChatMode;
    needsSearch: boolean;
    needsUrlContext: boolean;
    thinkingLevel: ThinkingLevel;
    reasoning: string;
}

/**
 * リサーチ計画
 * リサーチモードでmulti-step tool callingの前に生成される
 */
export interface ResearchPlan {
    searchQueries: Array<{
        query: string;
        purpose: string;
        language: 'en' | 'ja';
    }>;
    urlsToAnalyze: string[];
    expectedSources: string;
    fallbackStrategy: string;
}

/**
 * 品質チェック結果
 * リサーチモードの最終ステップで生成される
 */
export interface QualityCheckResult {
    accuracy: { score: number; issues: string[] };
    completeness: { score: number; gaps: string[] };
    usefulness: { score: number; improvements: string[] };
    overallScore: number;
    needsAdditionalSearch: boolean;
    additionalSearchQueries: string[];
}

/**
 * 会話要約
 * 中期記憶として保存される
 */
export interface ConversationSummary {
    projectContext: string;
    decisions: string[];
    userPreferences: string[];
    keyInformation: string[];
    currentState: string;
}

/**
 * ユーザー設定
 * 長期記憶としてIndexedDBに保存される
 */
export interface UserPreferences {
    id: string;
    language: string;
    codingStyle: string;
    preferredStack: string[];
    customInstructions: string;
    updatedAt: Date;
}

/**
 * 会話データ
 * IndexedDBに保存される会話の完全な情報
 */
export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    summary?: ConversationSummary;
    mode: ChatMode;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * メッセージデータ
 * AI SDK UIMessageとの互換性を維持
 */
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    parts?: MessagePart[];
    createdAt?: Date;
}

/**
 * メッセージパーツ
 * テキスト、画像、ファイル、ソース引用などを表現
 */
export type MessagePart =
    | { type: 'text'; text: string }
    | { type: 'thinking'; text: string }
    | { type: 'image'; url: string; alt?: string }
    | { type: 'file'; name: string; url: string; mimeType: string }
    | { type: 'source'; url: string; title: string; snippet?: string }
    | { type: 'tool-call'; toolName: string; args: any }
    | { type: 'tool-result'; toolName: string; result: any };

/**
 * APIリクエストのペイロード
 */
export interface ChatRequestPayload {
    messages: Message[];
    mode?: ChatMode;
    thinkingLevel?: ThinkingLevel;
    longTermMemory?: string;
    midTermSummary?: ConversationSummary | null;
}

/**
 * ツール呼び出し結果
 */
export interface ToolCallResult {
    toolName: string;
    success: boolean;
    result?: unknown;
    error?: string;
}
