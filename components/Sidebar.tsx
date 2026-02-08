/**
 * サイドバーコンポーネント
 * 過去の会話一覧を表示し、会話の切り替え・削除を行う
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllConversations, deleteConversation, createConversation } from '@/lib/db/conversations';
import type { Conversation, ChatMode } from '@/types';

interface SidebarProps {
    currentConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewConversation: (conversation: Conversation) => void;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 日付で会話をグループ化するヘルパー
 */
function groupConversations(conversations: Conversation[]) {
    const groups: { [key: string]: Conversation[] } = {
        '今日': [],
        '昨日': [],
        '過去7日間': [],
        'それ以前': [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    conversations.forEach(conv => {
        const date = new Date(conv.updatedAt);
        if (date >= today) {
            groups['今日'].push(conv);
        } else if (date >= yesterday) {
            groups['昨日'].push(conv);
        } else if (date >= lastWeek) {
            groups['過去7日間'].push(conv);
        } else {
            groups['それ以前'].push(conv);
        }
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

/**
 * サイドバー
 * 会話履歴の一覧表示と管理
 */
export function Sidebar({
    currentConversationId,
    onSelectConversation,
    onNewConversation,
    isOpen,
    onClose,
}: SidebarProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // 会話一覧を取得
    const loadConversations = useCallback(async () => {
        try {
            const convs = await getAllConversations();
            setConversations(convs);
        } catch (error) {
            console.error('[Sidebar] Failed to load conversations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // 会話を日付順にソート (最新が上)
    const sortedConversations = useMemo(() => {
        return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
    }, [conversations]);

    // グループ化
    const groupedConversations = useMemo(() => {
        return groupConversations(sortedConversations);
    }, [sortedConversations]);

    // 新しい会話を作成
    const handleNewConversation = async () => {
        try {
            const conversation = await createConversation('general');
            setConversations(prev => [conversation, ...prev]);
            onNewConversation(conversation);
        } catch (error) {
            console.error('[Sidebar] Failed to create conversation:', error);
        }
    };

    // 会話削除の開始
    const handleDeleteStart = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(id);
    };

    const confirmDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deleteConversation(id);
            setConversations(prev => prev.filter(c => c.id !== id));

            // 現在の会話を削除した場合、新しい会話を作成
            if (currentConversationId === id) {
                const conversation = await createConversation('general');
                setConversations(prev => [conversation, ...prev]);
                onNewConversation(conversation);
            }
        } catch (error) {
            console.error('[Sidebar] Failed to delete conversation:', error);
        } finally {
            setIsDeleting(null);
        }
    };

    const cancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleting(null);
    };

    // 日付をフォーマット
    const formatDate = (dateValue: Date | number) => {
        const date = new Date(dateValue);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今日';
        if (days === 1) return '昨日';
        if (days < 7) return `${days}日前`;
        return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    };

    return (
        <>
            {/* オーバーレイ（モバイル用） */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* サイドバー本体 */}
            <aside
                className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 bg-gray-900 border-r border-gray-800
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          flex flex-col h-full
        `}
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white">会話履歴</h2>
                    <button
                        onClick={handleNewConversation}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        aria-label="新しい会話を作成"
                        title="新しい会話"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* 会話一覧 */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-20">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            会話がありません
                        </div>
                    ) : (
                        groupedConversations.map(([groupName, items]) => (
                            <div key={groupName} className="mb-6">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-3">
                                    {groupName}
                                </h3>
                                <ul className="space-y-1">
                                    {items.map((conv) => (
                                        <li key={conv.id}>
                                            <div
                                                onClick={() => onSelectConversation(conv.id)}
                                                className={`
                                                  w-full text-left p-3 rounded-xl group cursor-pointer
                                                  transition-all duration-200
                                                  ${currentConversationId === conv.id
                                                        ? 'bg-blue-600 shadow-lg shadow-blue-500/20 text-white'
                                                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate flex-1 text-sm font-medium">
                                                        {conv.title}
                                                    </span>

                                                    {isDeleting === conv.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => confirmDelete(conv.id, e)}
                                                                className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                                                                aria-label="削除を確定"
                                                            >
                                                                <CheckIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={cancelDelete}
                                                                className="p-1 rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                                                                aria-label="削除をキャンセル"
                                                            >
                                                                <XMarkIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => handleDeleteStart(conv.id, e)}
                                                            className={`
                                                              p-1 rounded opacity-0 group-hover:opacity-100
                                                              transition-opacity duration-150
                                                              ${currentConversationId === conv.id
                                                                    ? 'hover:bg-blue-700 text-white/70 hover:text-white'
                                                                    : 'hover:bg-gray-700 text-gray-500 hover:text-red-400'
                                                                }
                                                            `}
                                                            aria-label="会話を削除"
                                                            title="削除"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-gray-800">
                    <div className="text-xs text-gray-500 text-center">
                        Ultimate Chat
                    </div>
                </div>
            </aside>
        </>
    );
}

// プラスアイコン
function PlusIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
    );
}

// ゴミ箱アイコン
function TrashIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
        </svg>
    );
}

// チェックアイコン
function CheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    );
}

// 閉じるアイコン
function XMarkIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}
