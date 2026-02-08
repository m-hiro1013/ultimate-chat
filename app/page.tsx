/**
 * メインチャットページ
 * useChat hookを使用したチャットUI（AI SDK v6対応）
 * IndexedDBによる会話永続化、サイドバー連携、キーボードショートカットを含む
 */

'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useCallback, useEffect } from 'react';
import { ChatWindow } from '@/components/ChatWindow';
import { InputArea } from '@/components/InputArea';
import { Sidebar } from '@/components/Sidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ThinkingIndicator } from '@/components/ThinkingIndicator';
import { UsageStats } from '@/components/UsageStats';
import {
  createConversation,
  getConversation,
  addMessage as dbAddMessage,
} from '@/lib/db/conversations';
import { getLongTermMemoryString } from '@/lib/db/preferences';
import { getIntegratedContext, shouldSummarize, generateAndSaveSummary } from '@/lib/context-manager';
import { isTextFile, isImageFile, isPdfFile, readTextFileWithLimit } from '@/lib/file-utils';
import type { ChatMode, ThinkingLevel, Conversation, Message as DBMessage, ConversationSummary } from '@/types';

/**
 * ホームページコンポーネント
 */
export default function Home() {
  // サイドバーの開閉状態
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 設定パネルの開閉状態
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 現在の会話
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  // モード設定
  const [mode, setMode] = useState<ChatMode>('general');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');

  // 長期記憶
  const [longTermMemory, setLongTermMemory] = useState<string>('');

  // 初期化フラグ
  const [initialized, setInitialized] = useState(false);

  // トークン使用量の累積
  const [totalUsage, setTotalUsage] = useState({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });

  // 中期記憶（要約）
  const [midTermSummary, setMidTermSummary] = useState<ConversationSummary | null>(null);

  // useChat hook - AI SDK v6
  const { messages, sendMessage, status, error, setMessages, stop } = (useChat as any)({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    body: {
      mode,
      thinkingLevel,
      longTermMemory,
      midTermSummary,
    },
    onFinish: async (result: any) => {
      // 会話をDBに保存
      if (currentConversation && result.message) {
        const message = result.message;
        // partsからテキストを抽出
        const textContent = message.parts
          ?.filter((part: { type: string }) => part.type === 'text')
          ?.map((part: { type: string; text?: string }) => part.text || '')
          ?.join('') || '';

        // 使用量を加算
        if (result.usage) {
          setTotalUsage(prev => ({
            promptTokens: prev.promptTokens + (result.usage?.promptTokens || 0),
            completionTokens: prev.completionTokens + (result.usage?.completionTokens || 0),
            totalTokens: prev.totalTokens + (result.usage?.totalTokens || 0),
          }));
        }

        const dbMessage: DBMessage = {
          id: message.id,
          role: 'assistant',
          content: textContent,
          parts: message.parts as any,
          usage: result.usage,
          createdAt: new Date(),
        };

        await dbAddMessage(currentConversation.id, dbMessage);

        // 必要に応じて要約を生成（中期記憶の更新）
        const updatedMessages = [...messages, dbMessage];
        if (shouldSummarize(updatedMessages as any, currentConversation.id)) {
          console.log('[Home] Triggering summary generation...');
          const newSummary = await generateAndSaveSummary(currentConversation.id, updatedMessages as any);
          if (newSummary) {
            setMidTermSummary(newSummary);
          }
        }
      }
    },
  });

  // 初期化: 長期記憶を取得し、前回の会話または新しい会話を作成
  useEffect(() => {
    const init = async () => {
      try {
        // 長期記憶を取得
        const memory = await getLongTermMemoryString();
        setLongTermMemory(memory);

        // 前回の会話IDを復元
        const lastConversationId = localStorage.getItem('lastConversationId');
        if (lastConversationId) {
          await handleSelectConversation(lastConversationId);
        } else {
          // 新しい会話を作成
          const conversation = await createConversation('general');
          setCurrentConversation(conversation);
          localStorage.setItem('lastConversationId', conversation.id);
        }
        setInitialized(true);
      } catch (error) {
        console.error('[Init] Failed:', error);
        // フォールバック: 新規作成
        const conversation = await createConversation('general');
        setCurrentConversation(conversation);
        setInitialized(true);
      }
    };

    init();
  }, []);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: 新しい会話
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateNewConversation();
      }

      // Ctrl/Cmd + /: サイドバー切り替え
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }

      // Ctrl/Cmd + ,: 設定を開く
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }

      // Escape: パネルを閉じる
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 新しい会話を作成
  const handleCreateNewConversation = useCallback(async () => {
    try {
      const conversation = await createConversation('general');
      setCurrentConversation(conversation);
      setMessages([]);
      setMode('general');
      setSidebarOpen(false);
    } catch (error) {
      console.error('[New Conversation] Failed:', error);
    }
  }, [setMessages]);

  // メッセージ送信ハンドラ
  const handleSubmit = useCallback(async (content: string, attachments: { file: File; dataUrl: string }[] = []) => {
    if (!content.trim() && attachments.length === 0) return;

    // ユーザーの質問テキストをまず追加
    const parts: any[] = [];
    if (content.trim()) {
      parts.push({ type: 'text', text: content });
    }

    // 添付ファイルを処理
    for (const att of attachments) {
      const fileName = att.file.name;

      if (isImageFile(att.file)) {
        // 画像: Geminiが直接処理できるdata URLで送信
        parts.push({
          type: 'image',
          url: att.dataUrl,
          alt: fileName,
        });
      } else if (isTextFile(att.file)) {
        // テキスト系ファイル: 中身を読み取ってtextパーツとして送信
        try {
          const result = await readTextFileWithLimit(att.file);
          const truncationNote = result.truncated
            ? ` (元のサイズ: ${result.originalLength.toLocaleString()}文字、一部省略)`
            : '';

          parts.push({
            type: 'text',
            text: [
              `<attached_file name="${fileName}" size="${(att.file.size / 1024).toFixed(1)}KB"${truncationNote}>`,
              result.text,
              `</attached_file>`,
            ].join('\n'),
          });
        } catch (err) {
          console.error('[FileRead] Failed:', fileName, err);
          parts.push({
            type: 'text',
            text: `[ファイル "${fileName}" の読み取りに失敗しました]`,
          });
        }
      } else if (isPdfFile(att.file)) {
        // PDF: Geminiが直接処理できるfileパーツで送信
        parts.push({
          type: 'file',
          url: att.dataUrl,
          mimeType: 'application/pdf',
          name: fileName,
        });
      } else {
        // その他のバイナリファイル: サポート外であることを明示
        parts.push({
          type: 'text',
          text: `[ファイル "${fileName}" (${att.file.type || '不明な形式'}) はテキストとして読み取れないため、内容を表示できません]`,
        });
      }
    }

    // partsが空の場合（content空 + ファイル処理失敗）は送信しない
    if (parts.length === 0) return;

    // ユーザーメッセージをDBに保存
    if (currentConversation) {
      const userMessage: DBMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content, // ユーザーが入力したテキストのみ
        parts: parts as any,
        createdAt: new Date(),
      };
      await dbAddMessage(currentConversation.id, userMessage);
    }

    sendMessage({ parts });
  }, [currentConversation, sendMessage]);

  // 会話を切り替え
  const handleSelectConversation = useCallback(async (id: string) => {
    try {
      const conversation = await getConversation(id);
      if (conversation) {
        setCurrentConversation(conversation);

        // メッセージを復元（AI SDK v6形式に変換、partsを優先）
        // GENSPARK 3.10/5.6: 思考ログやソース、ツール結果を正確に復元
        const restoredMessages = conversation.messages.map(m => {
          let parts = m.parts || [];

          if (parts.length === 0) {
            parts = [{ type: 'text', text: m.content }];
          } else {
            // シリアライズされたpartsの型を正規化
            parts = parts.map((part: any) => {
              // 既存の型を尊重しつつ、型定義に合わせる
              if (part.type === 'tool-call') return { ...part, type: 'tool-call' };
              if (part.type === 'tool-result') return { ...part, type: 'tool-result' };
              if (part.type === 'thinking') return { ...part, type: 'thinking' };
              if (part.type === 'source') return { ...part, type: 'source' };
              return part;
            });
          }

          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            parts: parts as any,
          };
        });

        // 累積使用量を計算
        const usage = conversation.messages.reduce((acc, m) => ({
          promptTokens: acc.promptTokens + (m.usage?.promptTokens || 0),
          completionTokens: acc.completionTokens + (m.usage?.completionTokens || 0),
          totalTokens: acc.totalTokens + (m.usage?.totalTokens || 0),
        }), { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
        setTotalUsage(usage);

        // 中期記憶（要約）も復元
        if (conversation.summary) {
          setMidTermSummary(conversation.summary);
        } else {
          setMidTermSummary(null);
        }

        setMessages(restoredMessages as any);
        setMode(conversation.mode);
      }
      setSidebarOpen(false);
      localStorage.setItem('lastConversationId', id);
    } catch (error) {
      console.error('[Select Conversation] Failed:', error);
    }
  }, [setMessages]);

  // 新しい会話を作成（サイドバーから）
  const handleNewConversation = useCallback((conversation: Conversation) => {
    setCurrentConversation(conversation);
    setMessages([]);
    setMode('general');
    setSidebarOpen(false);
  }, [setMessages]);

  // モード変更
  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
  }, []);

  // メッセージからテキストを抽出するヘルパー
  const getMessageText = (message: typeof messages[0]): string => {
    // partsからテキストを抽出
    if (message.parts && Array.isArray(message.parts)) {
      const textParts = message.parts
        .filter((part: any): part is { type: 'text'; text: string } =>
          part.type === 'text' && typeof part.text === 'string'
        )
        .map((part: any) => part.text);

      if (textParts.length > 0) {
        return textParts.join('');
      }
    }

    // フォールバック: contentプロパティがある場合
    if ('content' in message && typeof (message as any).content === 'string') {
      return (message as any).content;
    }

    return '';
  };

  // ローディング中
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* サイドバー */}
      <Sidebar
        currentConversationId={currentConversation?.id || null}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 設定パネル */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col h-[100dvh]">
        {/* ヘッダー */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="サイドバー (Ctrl+/)"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-white">
              {currentConversation?.title || 'Ultimate Chat'}
            </h1>
          </div>

          {/* モード表示 + 設定ボタン */}
          <div className="flex items-center gap-2">
            <span className={`
              px-2 py-1 rounded text-xs font-medium
              ${mode === 'general' ? 'bg-gray-700 text-gray-300' : ''}
              ${mode === 'research' ? 'bg-blue-600 text-white' : ''}
              ${mode === 'coding' ? 'bg-green-600 text-white' : ''}
            `}>
              {mode === 'general' && '一般'}
              {mode === 'research' && 'リサーチ'}
              {mode === 'coding' && 'コーディング'}
            </span>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="設定 (Ctrl+,)"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* トークン使用量統計 */}
        <UsageStats usage={totalUsage} />

        {/* チャットウィンドウ */}
        <ChatWindow
          messages={messages.map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: getMessageText(m),
            parts: m.parts as any,
          }))}
          isLoading={status === 'streaming'}
          onSelectSuggestion={handleSubmit}
        />

        {/* 思考中インジケータはChatWindow内で管理 */}

        {/* エラー表示 */}
        {error && (
          <div className="px-4 py-2 bg-red-900/50 border-t border-red-800 text-red-300 text-sm">
            エラーが発生しました: {error.message}
          </div>
        )}

        {/* 入力エリア */}
        <InputArea
          onSubmit={handleSubmit}
          mode={mode}
          onModeChange={handleModeChange}
          disabled={status !== 'ready' && status !== 'streaming'}
          isStreaming={status === 'streaming'}
          onStop={stop}
        />

        {/* キーボードショートカットのヒント */}
        <div className="hidden md:flex justify-center pb-2 text-xs text-gray-600 gap-4">
          <span>Ctrl+N: 新規会話</span>
          <span>Ctrl+/: サイドバー</span>
          <span>Ctrl+,: 設定</span>
        </div>
      </main>
    </div>
  );
}

// メニューアイコン
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// 設定アイコン
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
