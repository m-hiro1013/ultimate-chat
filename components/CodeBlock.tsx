/**
 * コードブロックコンポーネント
 * コピーボタンと言語ラベルを付加したコードブロック表示
 */

'use client';

import { useState, useCallback } from 'react';

interface CodeBlockProps {
    children: string;
    language?: string;
    className?: string;
}

/**
 * コードブロックをレンダリングするコンポーネント
 * シンタックスハイライトとコピーボタンを含む
 */
export function CodeBlock({ children, language, className }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    // コードをクリップボードにコピー
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [children]);

    return (
        <div className="relative group my-4 rounded-lg overflow-hidden bg-gray-900">
            {/* 言語ラベル + コピーボタン */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-400 text-sm">
                <span>{language || 'code'}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                >
                    {copied ? (
                        <>
                            <CheckIcon className="w-4 h-4 text-green-400" />
                            <span className="text-green-400">コピー済み</span>
                        </>
                    ) : (
                        <>
                            <CopyIcon className="w-4 h-4" />
                            <span>コピー</span>
                        </>
                    )}
                </button>
            </div>

            {/* コード本体 */}
            <pre className={`p-4 overflow-x-auto text-sm text-gray-100 ${className || ''}`}>
                <code className={`text-gray-100 ${language ? `language-${language}` : ''}`}>
                    {children}
                </code>
            </pre>
        </div>
    );
}

// コピーアイコン
function CopyIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
        </svg>
    );
}

// チェックアイコン
function CheckIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
            />
        </svg>
    );
}
