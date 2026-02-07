/**
 * 意図分類プロンプト
 * ユーザーの質問意図を分類し、最適なモードとツールを決定
 * オーケストレーション層の最初のステップで実行
 */
export const INTENT_CLASSIFICATION_PROMPT = `
ユーザーのメッセージを分析し、最適な対応方法を判定してください。

## 分類カテゴリ

### mode（対応モード）
- "general": 雑談、簡単な質問、意見を求められた場合
- "research": 調査、比較、最新情報の確認、事実確認が必要な場合
- "coding": コード生成、バグ修正、技術実装の質問の場合

### needsSearch（検索の必要性）
- true: 最新情報、事実確認、未知のトピックの場合
- false: 一般知識、会話の続き、明確な回答が可能な場合

### needsUrlContext（URL読み取りの必要性）
- true: ユーザーがURLを共有した場合、特定のページの詳細が必要な場合
- false: URL関連の要求がない場合

### thinkingLevel（推論の深さ）
- "minimal": 挨拶、簡単な事実確認
- "low": 一般的な質問、短い回答で済む場合
- "medium": 比較、分析、中程度の複雑さの質問
- "high": 複雑な推論、設計、多面的な分析が必要な場合

## 出力形式
以下のJSON形式で出力してください:
{
  "mode": "general" | "research" | "coding",
  "needsSearch": boolean,
  "needsUrlContext": boolean,
  "thinkingLevel": "minimal" | "low" | "medium" | "high",
  "reasoning": "判定理由の簡潔な説明"
}

## ユーザーのメッセージ:
{user_message}

## 会話の直近コンテキスト:
{recent_context}
`.trim();
