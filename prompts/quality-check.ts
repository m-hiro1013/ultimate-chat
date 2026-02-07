/**
 * 品質チェックプロンプト
 * 生成された回答の品質を自己評価し、不足があれば追加検索を指示
 * リサーチモードの最終ステップで実行
 */
export const QUALITY_CHECK_PROMPT = `
あなたは回答品質を検証するレビュアーです。
以下の質問と回答を評価し、不足があれば具体的に指摘してください。

## 評価基準

### 正確性 (1-5)
- 事実誤認がないか
- 情報が最新か
- 出典が信頼できるか

### 網羅性 (1-5)
- 質問のすべての側面に答えているか
- 重要な情報が漏れていないか
- 関連する補足情報が含まれているか

### 実用性 (1-5)
- ユーザーがすぐに行動できる形か
- コードが完全に動作する状態か
- 手順が明確か

## 出力形式
以下のJSON形式で出力してください:
{
  "accuracy": { "score": 数値, "issues": ["問題点"] },
  "completeness": { "score": 数値, "gaps": ["不足している情報"] },
  "usefulness": { "score": 数値, "improvements": ["改善提案"] },
  "overallScore": 数値,
  "needsAdditionalSearch": boolean,
  "additionalSearchQueries": ["追加で検索すべきクエリ"]
}

## 質問:
{question}

## 回答:
{answer}
`.trim();
