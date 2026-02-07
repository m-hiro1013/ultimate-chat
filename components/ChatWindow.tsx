/**
 * チャットウィンドウコンポーネント
 * メッセージリストの表示コンテナ、自動スクロール、ローディング表示
 */

'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import type { Message } from '@/types';

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    onSelectSuggestion?: (text: string) => void;
}

/**
 * チャットメッセージを表示するスクロール可能なウィンドウ
 */
export function ChatWindow({ messages, isLoading, onSelectSuggestion }: ChatWindowProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // 新しいメッセージ or ローディング状態変化で自動スクロール
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6">
            {/* 空の状態 */}
            {messages.length === 0 && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="text-6xl mb-4">🤖</div>
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Ultimate Chat へようこそ
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md">
                        何でも聞いてください。
                        <br />
                        Web検索、URL読み取り、コード生成など、
                        <br />
                        あらゆるタスクをサポートします。
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <SuggestionChip
                            emoji="🔍"
                            text="最新のAI動向を調べて"
                            onClick={() => onSelectSuggestion?.("最新のAI動向を調べて")}
                        />
                        <SuggestionChip
                            emoji="💻"
                            text="Next.jsでTodoアプリを作って"
                            onClick={() => onSelectSuggestion?.("Next.jsでTodoアプリを作って")}
                        />
                        <SuggestionChip
                            emoji="📖"
                            text="この記事を要約して"
                            onClick={() => onSelectSuggestion?.("この記事を要約して")}
                        />
                    </div>
                </div>
            )}

            {/* メッセージリスト */}
            {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
            ))}

            {/* 思考中インジケータ */}
            {isLoading && (
                <div className="mb-4">
                    {(() => {
                        const lastMessage = messages[messages.length - 1];
                        let status: 'thinking' | 'searching' | 'reading' | 'analyzing' = 'thinking';

                        if (lastMessage?.role === 'assistant' && lastMessage?.parts) {
                            const toolCalls = lastMessage.parts.filter(p => p.type === 'tool-call');
                            const lastTool = toolCalls[toolCalls.length - 1];
                            if (lastTool && 'toolName' in lastTool) {
                                if (lastTool.toolName === 'google_search') status = 'searching';
                                if (lastTool.toolName === 'url_context') status = 'reading';
                            }
                        }

                        return <ThinkingIndicator isThinking={true} status={status} />;
                    })()}
                </div>
            )}

            {/* スクロール用のアンカー */}
            <div ref={bottomRef} />
        </div>
    );
}

/**
 * 提案チップ（空の状態で表示）
 */
function SuggestionChip({ emoji, text, onClick }: { emoji: string; text: string; onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
            <span>{emoji}</span>
            <span>{text}</span>
        </button>
    );
}
