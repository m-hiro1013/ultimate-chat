/**
 * 入力エリアコンポーネント
 * テキスト入力、ファイル添付ボタン、モード切替、送信ボタン
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FileUpload } from './FileUpload';
import type { ChatMode } from '@/types';

interface InputAreaProps {
    onSubmit: (message: string, attachments?: { file: File; dataUrl: string }[]) => void;
    mode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    disabled?: boolean;
    isStreaming?: boolean;
    onStop?: () => void;
}

/**
 * チャット入力エリア
 * Ctrl+Enterで送信、モード切替、ファイル添付対応
 */
export function InputArea({ onSubmit, mode, onModeChange, disabled = false, isStreaming = false, onStop }: InputAreaProps) {
    const [input, setInput] = useState('');
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [attachments, setAttachments] = useState<{ file: File; dataUrl: string }[]>([]);
    const [isComposing, setIsComposing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // テキストエリアの高さを自動調整
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
        }
    }, [input]);

    // 送信処理
    const handleSubmit = useCallback(() => {
        if (!input.trim() && attachments.length === 0) return;
        if (disabled && !isStreaming) return;

        onSubmit(input.trim(), attachments);
        setInput('');
        setAttachments([]);
        setShowFileUpload(false);

        // 送信後にフォーカスを戻す (P1)
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    }, [input, attachments, disabled, isStreaming, onSubmit]);

    // キーボードショートカット
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            // IME入力中は送信しない (P1)
            if (isComposing) return;

            // Ctrl+Enter or Cmd+Enter で送信
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit, isComposing]
    );

    // ファイル選択ハンドラ
    const handleFileSelect = useCallback((file: File, dataUrl: string) => {
        setAttachments((prev) => [...prev, { file, dataUrl }]);
    }, []);

    // 添付ファイル削除
    const removeAttachment = useCallback((index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // ドラッグ&ドロップ
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                handleFileSelect(file, ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        });
    }, [handleFileSelect]);

    const modes: { value: ChatMode; label: string; icon: string }[] = [
        { value: 'general', label: '一般', icon: '💬' },
        { value: 'research', label: 'リサーチ', icon: '🔍' },
        { value: 'coding', label: 'コーディング', icon: '💻' },
    ];

    return (
        <div
            className={`
                border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 transition-all duration-200
                ${isDragging ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* モード切替 */}
            <div className="flex gap-2 mb-3">
                {modes.map((m) => (
                    <button
                        key={m.value}
                        onClick={() => onModeChange(m.value)}
                        className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${mode === m.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }
            `}
                        aria-label={`${m.label}モードに切り替え`}
                    >
                        <span>{m.icon}</span>
                        <span>{m.label}</span>
                    </button>
                ))}
            </div>

            {/* 添付ファイルプレビュー */}
            {attachments.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                    {attachments.map((att, index) => (
                        <div
                            key={index}
                            className="relative group bg-gray-100 dark:bg-gray-800 rounded-lg p-2"
                        >
                            {att.file.type.startsWith('image/') ? (
                                <img
                                    src={att.dataUrl}
                                    alt="Attachment"
                                    className="w-16 h-16 object-cover rounded"
                                />
                            ) : (
                                <div className="w-16 h-16 flex items-center justify-center">
                                    <span className="text-2xl">📄</span>
                                </div>
                            )}
                            <button
                                onClick={() => removeAttachment(index)}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ファイルアップロードエリア */}
            {showFileUpload && (
                <div className="mb-3">
                    <FileUpload onFileSelect={handleFileSelect} />
                </div>
            )}

            {/* 入力フィールド */}
            <div className="flex gap-2 items-end">
                {/* ファイル添付ボタン */}
                <button
                    onClick={() => setShowFileUpload(!showFileUpload)}
                    className={`
            p-2 rounded-lg transition-colors
            ${showFileUpload ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:hover:bg-gray-800 text-gray-500'}
          `}
                    aria-label="ファイルを添付"
                    title="ファイルを添付"
                >
                    <PaperClipIcon className="w-5 h-5" />
                </button>

                {/* テキストエリア */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}
                        placeholder="メッセージを入力... (Ctrl+Enterで送信)"
                        rows={1}
                        className="
              w-full px-4 py-3 rounded-xl resize-none
              bg-gray-100 dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50
            "
                        disabled={disabled}
                    />
                </div>

                {/* 送信ボタン */}
                <button
                    onClick={isStreaming ? onStop : handleSubmit}
                    disabled={(!isStreaming && disabled) || (!isStreaming && !input.trim() && attachments.length === 0)}
                    className={`
            p-3 rounded-xl transition-colors
            ${isStreaming
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'}
          `}
                    aria-label={isStreaming ? '生成を中止' : 'メッセージを送信'}
                >
                    {isStreaming ? (
                        <StopIcon className="w-5 h-5" />
                    ) : (
                        <SendIcon className="w-5 h-5" />
                    )}
                </button>
            </div>

            {/* ヒント */}
            <p className="mt-2 text-xs text-gray-400 text-center hidden md:block">
                Ctrl+Enter で送信 • ファイルをドラッグ&ドロップで添付
            </p>
        </div>
    );
}

// アイコンコンポーネント
function PaperClipIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
    );
}

function SendIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
    );
}

function StopIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" strokeWidth={2} rx="1" stroke="currentColor" />
        </svg>
    );
}

function LoadingIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}
