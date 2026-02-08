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
### 2026-02-08 (GENSPARK準拠と使用量UI)

- **Learnings (+3)**:
    - AI SDK の `onFinish` で返却される `usage` オブジェクトを累積することで、セッション全体のトークンコストをリアルタイムに算出可能。
    - Multimodal (Gemini) において、過去のメッセージ履歴を復元する際は `content` (string) だけでなく `parts` (array) をそのまま渡すことが極めて重要。Thought Signature が含まれる場合、単なる文字列復元だと不整合で 400 エラーになる。
    - `mediaResolution` パラメータを添付ファイルの有無に応じて `MEDIA_RESOLUTION_HIGH` に切り替えることで、GENSPARKの要件を満たしつつトークン効率を最適化できる。
    - ファイル解析プロンプトはメッセージの「直前」に配置することで、AIの理解度が向上する。

- **Pain Points (+2)**:
    - `react-markdown` で `parts` を直接扱う場合、テキストパーツだけを抽出して結合するロジックが必要（以前は content のみで良かったが、parts ベースに移行したため）。
    - IndexedDB に `parts` を保存する場合、ファイルデータ (base64) が巨大化するため、ストレージ容量に配慮が必要（現在はそのまま保存しているが、将来的に URL 参照等への移行検討余地あり）。
