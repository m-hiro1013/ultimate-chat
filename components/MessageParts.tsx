/**
 * メッセージパーツコンポーネント
 * テキスト/画像/ファイル/ソース引用を適切にレンダリング
 */

'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { SourceCitation } from './SourceCitation';
import type { MessagePart } from '@/types';

interface MessagePartsProps {
    content: string;
    parts?: MessagePart[];
}

/**
 * メッセージの各パーツをレンダリング
 */
export function MessageParts({ content, parts }: MessagePartsProps) {
    // ソースパーツを抽出
    const sources = parts?.filter((p): p is Extract<MessagePart, { type: 'source' }> => p.type === 'source') ?? [];

    return (
        <div className="message-content">
            {/* メインテキスト（Markdown） */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                        // コードブロックをカスタムコンポーネントでレンダリング
                        code({ node, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match;

                            // childrenを安全に文字列化
                            const getCodeString = (child: React.ReactNode): string => {
                                if (typeof child === 'string') return child;
                                if (typeof child === 'number') return String(child);
                                if (Array.isArray(child)) return child.map(getCodeString).join('');
                                if (child && typeof child === 'object' && 'props' in child) {
                                    return getCodeString((child as any).props?.children);
                                }
                                return '';
                            };
                            const codeString = getCodeString(children).replace(/\n$/, '');

                            if (isInline) {
                                return (
                                    <code
                                        className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm"
                                        {...props}
                                    >
                                        {codeString}
                                    </code>
                                );
                            }

                            return (
                                <CodeBlock language={match[1]}>
                                    {codeString}
                                </CodeBlock>
                            );
                        },
                        // リンクを新しいタブで開く
                        a({ href, children }) {
                            return (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {children}
                                </a>
                            );
                        },
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>

            {/* 画像パーツ */}
            {parts
                ?.filter((p): p is Extract<MessagePart, { type: 'image' }> => p.type === 'image')
                .map((part, index) => (
                    <div key={index} className="mt-3">
                        <img
                            src={part.url}
                            alt={part.alt || 'Image'}
                            className="max-w-full rounded-lg shadow-md"
                        />
                    </div>
                ))}

            {/* ファイルパーツ */}
            {parts
                ?.filter((p): p is Extract<MessagePart, { type: 'file' }> => p.type === 'file')
                .map((part, index) => (
                    <div
                        key={index}
                        className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-3"
                    >
                        <FileIcon className="w-8 h-8 text-gray-500" />
                        <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {part.name}
                            </p>
                            <p className="text-xs text-gray-500">{part.mimeType}</p>
                        </div>
                    </div>
                ))}

            {/* ソース引用 */}
            {sources.length > 0 && <SourceCitation sources={sources} />}
        </div>
    );
}

// ファイルアイコン
function FileIcon({ className }: { className?: string }) {
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
        </svg>
    );
}
