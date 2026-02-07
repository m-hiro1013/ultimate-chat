# Ultimate Chat - ナレッジベース
# 🎀 セッションで得た知見を蓄積するよ！

## セッションログ

### 2026-02-07 セッション

#### 学んだこと（+3 = 必須級, +2 = 推奨, +1 = 参考）

| 知見 | ウェイト | カテゴリ |
|------|---------|---------|
| AI SDK v6では`handleSubmit`/`handleInputChange`は存在しない。`sendMessage({ text })`を使用 | +3 | AI SDK |
| AI SDK v6では`DefaultChatTransport`でAPIエンドポイントを指定する | +3 | AI SDK |
| Gemini 3 FlashのTemperatureは1.0固定（変更すると推論品質が低下） | +3 | Gemini |
| Gemini 3 Flashの`thinkingLevel`は`providerOptions.google.thinkingConfig`で設定 | +3 | Gemini |
| ReactMarkdownのchildrenは単純な`String()`では変換できない。再帰的にReactノードを処理する必要がある | +2 | React |
| HTMLでは`<button>`の中に`<button>`をネストできない（hydrationエラー） | +2 | HTML |

#### ハマったポイント

1. **AI SDK v6のAPI変更**
   - 問題: `append is not a function`エラー
   - 原因: AI SDK v6では`useChat`の返り値が変更された
   - 解決: `sendMessage({ text })` + `DefaultChatTransport`を使用

2. **コードブロックの[object Object]表示**
   - 問題: コードブロック内に`[object Object]`が表示される
   - 原因: ReactMarkdownのchildrenがReactノードの配列になっている
   - 解決: 再帰的に文字列を抽出する`getCodeString`関数を実装

3. **ボタンのネストエラー**
   - 問題: Hydrationエラー（ボタン内にボタン）
   - 原因: サイドバーの会話アイテムがbutton要素で、削除ボタンもその中にある
   - 解決: 外側のボタンをdiv要素に変更

---

## 技術メモ

### Gemini 3 Flash Preview

```typescript
// AI SDK経由でのthinkingLevel設定
const result = streamText({
  model: google('gemini-3-flash-preview'),
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingLevel: 'high', // minimal, low, medium, high
      },
    } satisfies GoogleGenerativeAIProviderOptions,
  },
});
```

### AI SDK v6 useChat

```typescript
// 正しいAPI使用
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
  }),
});

// メッセージ送信
sendMessage({ text: content });

// ローディング状態
const isLoading = status === 'streaming';
```
