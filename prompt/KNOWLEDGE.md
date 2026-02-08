### 2026-02-08 セッション（Phase 2: 究極リサーチ対応）

#### 学んだこと（+3 = 必須級, +2 = 推奨, +1 = 参考）

| 知見 | ウェイト | カテゴリ |
|------|---------|---------|
| `stopWhen` (AI SDK) で `stepCountIs` を使用すると多段ツール呼び出しを制御可能。リサーチには10ステップ程度が妥当 | +3 | AI SDK |
| Gemini 3 Flashのビルトインツール（Search/URL）とカスタムFunction Callingের併用は現在制限がある | +3 | Gemini |
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
### 2026-02-08 Session III (AI SDK v6 Transition & Attachment Optimization)

#### 学んだこと（+3 = 必須級, +2 = 推奨, +1 = 参考）

| 知見 | ウェイト | カテゴリ |
|------|---------|---------|
| AI SDK v6 (streamText) では `maxSteps` はトップレベルオプションだが、一部の状態管理と不整合が出る場合は明示的な制御が必要な場合がある | +3 | AI SDK |
| `maxTokens` はトップレベルではなく `providerOptions.google` 内に配置する必要がある（Gemini固有パラメータとしての扱い） | +3 | Gemini |
| 添付ファイルがある場合にシステムプロンプトに「解析手順」を動的に注入することで、AIの根拠提示（引用）の質が劇的に向上する | +2 | Prompting |
| `mediaResolution: 'MEDIA_RESOLUTION_HIGH'` はファイル添付時のみ有効にすることで、トークン節約と精度のバランスを取れる | +2 | Cost |

#### ハマったポイント

1. **AI SDK v6 のプロパティ位置**
   - 問題: `maxTokens` を `streamText` のトップレベルに置くと TypeScript エラーが発生、または無視される。
   - 解決: `providerOptions.google` 配下に移動。SDKのバージョンアップに伴う破壊的変更や型定義の厳格化に注意が必要。

2. **自動モード判定の不発**
   - 問題: 「深掘りして」などのキーワードが一般モードに判定されていた。
   - 解決: `detectModeQuick` のキーワードリストを拡張し、日本語特有の表現（「調べて」「徹底的に」等）を強化。

3. **添付ファイルによるチャット画面の埋め尽くし**
   - 問題: テキストファイルを添付すると全文が「テキストパーツ」として表示され、画面が非常に長くなる。
   - 解決: 送信時にテキストファイルも `type: 'file'` パーツとして扱うように変更。UI上はアイコンとファイル名のみが表示され、AIには `parts` 経由で全文が伝わる設計にした。

### 2026-02-08 セッション IV (UX & アクセシビリティの完成)

#### 学んだこと（+3 = 必須級, +2 = 推奨, +1 = 参考）

| 知見 | ウェイト | カテゴリ |
|------|---------|---------|
| iOS Safari等のモバイルブラウザでは `100vh` ではなく `100dvh` (Dynamic Viewport Height) を使うのが鉄則 | +3 | CSS/UI |
| 日本語IME入力中にEnterキーで送信されるのを防ぐには `onCompositionStart/End` でフラグ管理を行う | +3 | Interaction |
| 外部アイコンライブラリへの依存は開発環境（サンドボックス）でパス解決の問題を引き起こすことがあるため、重要なUI部品はインラインSVG化して自己完結させると堅牢 | +2 | Architecture |
| 会話履歴を「今日」「昨日」等でグループ化することで、長期的な利用におけるナビゲーションコストを劇的に下げられる | +2 | UI/UX |
| 削除アクション等において `window.confirm` を排除しカスタムUIを提供することで、プレミアムなユーザー体験を維持できる | +2 | UI/UX |

#### ハマったポイント

1. **スクロールコンフリクト**
   - 問題: AIの回答中にユーザーが過去の会話を読もうと上にスクロールしても, 自動スクロールが働いて下に引き戻される問題。
   - 解決: スクロール位置が「最下部近辺」にある、または「ユーザー自身の直近送信」の場合のみ `scrollIntoView` を実行する条件分岐を導入した。

2. **アイコンの表示不良**
   - 問題: Heroiconsをインポートしようとした際、依存関係やパッケージの場所によりサンドボックス内でエラーが発生した。
   - 解決: `PlusIcon`, `TrashIcon` 等をすべてコンポーネント内にインポートせずに SVG として定義することで、完全に自立したコンポーネントにした。

3. **IME送信の二重性**
   - 問題: 変換確定の Enter でメッセージが送信されてしまう。
   - 解決: `InputArea` で `isComposing` ステートを管理し、`KeyboardEvent` のハンドラでこのフラグが立っている間は `preventDefault` を含め送信処理をスキップするようにした。
