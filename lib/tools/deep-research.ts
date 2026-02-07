/**
 * Deep Research ツール
 * リサーチ計画を立案し、多段階調査を支援する
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ResearchPlan } from '@/types';

/**
 * リサーチ計画立案ツール
 * Geminiがこのツールを呼び出すことで、体系的な調査計画を取得できる
 */
export const deepResearchTool = tool({
    description: `
    複雑なリサーチタスクの調査計画を立案します。
    このツールは以下の場合に使用してください：
    - 複数の側面から調査が必要な質問
    - 最新かつ網羅的な情報が必要な場合
    - 技術的な比較や詳細な分析が必要な場合
  `,
    parameters: z.object({
        question: z.string().describe('調査対象の質問・トピック'),
        aspectsToInvestigate: z.array(z.string()).describe('調査すべき側面のリスト'),
        preferredLanguages: z.array(z.enum(['en', 'ja'])).describe('検索に使用する言語'),
    }),
    execute: async ({ question, aspectsToInvestigate, preferredLanguages }): Promise<ResearchPlan> => {
        // 各側面に対して検索クエリを生成
        const searchQueries = aspectsToInvestigate.flatMap((aspect, index) => {
            return preferredLanguages.map(lang => ({
                query: lang === 'en'
                    ? `${question} ${aspect}`
                    : `${question} ${aspect}`,
                purpose: `${aspect}について調査`,
                language: lang as 'en' | 'ja',
            }));
        });

        // 最大5クエリに制限
        const limitedQueries = searchQueries.slice(0, 5);

        return {
            searchQueries: limitedQueries,
            urlsToAnalyze: [],
            expectedSources: '公式ドキュメント、技術ブログ、GitHubリポジトリ',
            fallbackStrategy: '異なるキーワードで再検索、または関連トピックから情報を収集',
        };
    },
});

/**
 * ファイル解析ツール
 * 添付ファイルの詳細分析を行う
 */
export const analyzeFileTool = tool({
    description: `
    添付されたファイルの詳細な分析を行います。
    コード、ログ、設定ファイル、画像などの内容を解析し、
    ユーザーの質問に関連する情報を抽出します。
  `,
    parameters: z.object({
        fileType: z.enum(['code', 'log', 'config', 'image', 'document', 'other'])
            .describe('ファイルの種類'),
        fileName: z.string().describe('ファイル名'),
        analysisGoal: z.string().describe('分析の目的・何を調べたいか'),
    }),
    execute: async ({ fileType, fileName, analysisGoal }) => {
        // ファイル種類に応じた分析指示を返す
        const analysisInstructions: Record<string, string> = {
            code: `
        コードファイル "${fileName}" を分析します。
        目的: ${analysisGoal}
        確認項目:
        - コードの構造と目的
        - 潜在的なバグやアンチパターン
        - パフォーマンス改善の余地
        - セキュリティ上の懸念
      `,
            log: `
        ログファイル "${fileName}" を分析します。
        目的: ${analysisGoal}
        確認項目:
        - エラーパターンの特定
        - 異常な動作の検出
        - タイムライン分析
      `,
            config: `
        設定ファイル "${fileName}" を分析します。
        目的: ${analysisGoal}
        確認項目:
        - 各設定項目の意味
        - 推奨設定との差異
        - セキュリティ設定
      `,
            image: `
        画像ファイル "${fileName}" を分析します。
        目的: ${analysisGoal}
        確認項目:
        - 画像の内容説明
        - テキストの抽出（OCR）
        - 図表データの解釈
      `,
            document: `
        ドキュメント "${fileName}" を分析します。
        目的: ${analysisGoal}
        確認項目:
        - 文書の構造と概要
        - 重要なポイントの抽出
        - 質問に関連する箇所
      `,
            other: `
        ファイル "${fileName}" を分析します。
        目的: ${analysisGoal}
      `,
        };

        return {
            instructions: analysisInstructions[fileType] || analysisInstructions.other,
            fileType,
            fileName,
        };
    },
});

/**
 * コード生成補助ツール
 * コード生成時の追加情報を取得
 */
export const codeGenerationTool = tool({
    description: `
    コード生成を補助するための情報を取得します。
    最新のライブラリバージョン確認、ベストプラクティスの参照などに使用します。
  `,
    parameters: z.object({
        technology: z.string().describe('使用する技術・フレームワーク'),
        task: z.string().describe('実装したいタスク'),
        constraints: z.array(z.string()).optional().describe('制約条件'),
    }),
    execute: async ({ technology, task, constraints }) => {
        return {
            recommendations: [
                `${technology}の最新のベストプラクティスに従って実装`,
                '型安全性を重視したTypeScriptコード',
                'エラーハンドリングを含める',
                'コメントは日本語で記述',
            ],
            searchQuery: `${technology} ${task} best practices 2025`,
            constraints: constraints || [],
        };
    },
});

/**
 * 全ツールをエクスポート
 */
export const customTools = {
    deepResearch: deepResearchTool,
    analyzeFile: analyzeFileTool,
    codeGeneration: codeGenerationTool,
};
