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
import { ThinkingBlock } from './ThinkingBlock';
import { SearchQueries } from './SearchQueries';
import type { MessagePart } from '@/types';

/**
 * インライン引用 [1], [2] 等をリンクに変換する簡易処理
 */
function processInlineCitations(content: string, sources: any[]): string {
    return content.replace(/\[(\d+)\]/g, (match, num) => {
        const index = parseInt(num) - 1;
        if (sources[index]) {
            return `[${num}](${sources[index].url})`;
        }
        return match;
    });
}

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

    // 思考プロセスを抽出
    const thinkingParts = parts?.filter(
        (p): p is { type: 'thinking'; text: string } => p.type === 'thinking'
    ) ?? [];

    // 検索クエリを抽出（tool-callから）
    const toolCalls = parts?.filter(
        (p): p is { type: 'tool-call'; toolName: string; args: any } => p.type === 'tool-call'
    ) ?? [];
    const searchQueries = toolCalls
        .filter(tc => tc.toolName === 'google_search')
        .map(tc => tc.args?.query || '')
        .filter(Boolean);

    // インライン引用を処理
    const processedContent = sources.length > 0
        ? processInlineCitations(content, sources)
        : content;

    return (
        <div className="message-content space-y-2">
            {/* 思考プロセス */}
            {thinkingParts.map((part, i) => (
                <ThinkingBlock key={`thinking-${i}`} content={part.text} />
            ))}

            {/* 検索クエリ */}
            {searchQueries.length > 0 && <SearchQueries queries={searchQueries} />}

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
                    {processedContent}
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
