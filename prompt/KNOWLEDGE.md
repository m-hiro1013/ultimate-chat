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

### 2026-02-08 セッション II（GENSPARK基準準拠改善）

#### 学んだこと（+3 = 必須級, +2 = 推奨, +1 = 参考）

| 知見 | ウェイト | カテゴリ |
|------|---------|---------|
| Gemini 3 FlashでのFunction Callingでは、モデルが出力した `thoughtSignature` を次のリクエストの履歴に含めないと400エラーが発生する | +3 | Gemini |
| AI SDK v6において `parts` ベースの通信を行う場合、型定義 (`MessagePart`) を拡張し、`toUIMessageStreamResponse` への橋渡しを正確に行う必要がある | +3 | AI SDK |
| `maxSteps` は `streamText` の最上位オプションとして設定可能。リサーチモードでは10ステップが深掘りのベストプラクティス | +2 | AI SDK |
| ユーザーの信頼性（Genspark基準）を確保するためには、AIの思考やツール呼び出し（検索クエリ）を個別のUIパーツとして可視化することが極めて有効 | +2 | UI/UX |

#### ハマったポイント

1. **Thought Signatureの消失**
   - 問題: マルチターン会話で突然400エラーが発生する
   - 原因: 会話履歴を `content: string` に丸める際、モデルが生成した `thoughtSignature` (parts内の特殊パーツ) が消失していた
   - 解決: サーバー・クライアント間の通信で一貫して `parts` を保持し、履歴再構成時にもそのままGeminiに返すようにした

2. **UIコンポーネントのHydrationとネスト**
   - 問題: インライン引用 [1] などをMarkdownリンクに変換する際、レンダリングが複雑化
   - 解決: `MessageParts` にて正規表現で事前処理を行い、`ReactMarkdown` がリンクとして安全に処理できるように調整

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
// 正しいAPI使用 (MessageParts対応)
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
  }),
});

// メッセージ送信 (partsを使用)
const parts = [{ type: 'text', text: content }];
sendMessage({ parts });
```
