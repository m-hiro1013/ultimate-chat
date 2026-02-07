/**
 * メッセージバブルコンポーネント
 * 個別メッセージの表示（Markdown対応）
 */

'use client';

import { MessageParts } from './MessageParts';
import type { Message } from '@/types';

interface MessageBubbleProps {
    message: Message;
}

/**
 * 個別メッセージをバブル形式で表示
 */
export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    return (
        <div
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
        >
            <div
                className={`
          max-w-[85%] rounded-2xl px-4 py-3
          ${isUser
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                    }
        `}
            >
                {/* アバター + ロールラベル（アシスタントのみ） */}
                {!isUser && (
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-xl">🤖</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            AI Assistant
                        </span>
                    </div>
                )}

                {/* メッセージ本文 */}
                <MessageParts content={message.content} parts={message.parts} />

                {/* タイムスタンプ */}
                {message.createdAt && (
                    <div
                        className={`
              mt-2 text-xs
              ${isUser ? 'text-blue-200' : 'text-gray-400'}
            `}
                    >
                        {new Date(message.createdAt).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
