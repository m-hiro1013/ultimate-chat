/**
 * 検索ソース引用コンポーネント
 * Google SearchのgroundingMetadataを解析し、出典リンクをインライン表示
 */

'use client';

interface Source {
    url: string;
    title: string;
    snippet?: string;
}

interface SourceCitationProps {
    sources: Source[];
}

/**
 * 検索ソースの引用をカード形式で表示
 */
export function SourceCitation({ sources }: SourceCitationProps) {
    if (!sources || sources.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
                📚 参照ソース
            </h4>
            <div className="grid gap-2">
                {sources.map((source, index) => (
                    <a
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            {/* ファビコン風のインデックス */}
                            <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-medium flex items-center justify-center">
                                {index + 1}
                            </span>

                            <div className="flex-1 min-w-0">
                                {/* タイトル */}
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    {source.title}
                                </p>

                                {/* URL */}
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                    {(() => {
                                        try {
                                            return new URL(source.url).hostname;
                                        } catch (e) {
                                            return source.url;
                                        }
                                    })()}
                                </p>

                                {/* スニペット（あれば） */}
                                {source.snippet && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                        {source.snippet}
                                    </p>
                                )}
                            </div>

                            {/* 外部リンクアイコン */}
                            <ExternalLinkIcon className="flex-shrink-0 w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
}

// 外部リンクアイコン
function ExternalLinkIcon({ className }: { className?: string }) {
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
        </svg>
    );
}
