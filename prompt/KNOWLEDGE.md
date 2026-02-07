### 2026-02-08 セッション（Phase 2: 究極リサーチ対応）

#### 学んだこと（+3 = 必須級, +2 = 推奨, +1 = 参考）

| 知見 | ウェイト | カテゴリ |
|------|---------|---------|
| `stopWhen` (AI SDK) で `stepCountIs` を使用すると多段ツール呼び出しを制御可能。リサーチには10ステップ程度が妥当 | +3 | AI SDK |
| Gemini 3 Flashのビルトインツール（Search/URL）とカスタムFunction Callingの併用は現在制限がある | +3 | Gemini |
| 背景タスク（要約・計画生成）は `thinkingLevel: 'low'` で十分かつコスト効率が高い | +2 | Cost |
| AI SDK v6の `toUIMessageStreamResponse` で `sendSources: true` を設定するとGrounding Metadataが転送される | +2 | AI SDK |

#### ハマったポイント

1. **ビルトインツールとカスタムツールの不整合**
   - 問題: Google Searchを有効にすると、自前のDeep Researchツールが呼ばれなくなる
   - 原因: GeminiのビルトインツールとFunction Callingの併用制限によるもの
   - 解決: リサーチ機能をビルトインの `google_search` + `url_context` + `stopWhen` ループに委ねることで、外部ツールなしで高性能なリサーチを実現した

2. **FileUploadのバイナリ整合性**
   - 問題: フロントエンドでファイルデータがAPIまで到達していなかった
   - 解決: `sendMessage({ parts })` を使用し、各ファイルを `type: 'file'` パートとして明示的に送信するように修正


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
