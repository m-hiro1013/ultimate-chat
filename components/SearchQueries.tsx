'use client';

interface SearchQueriesProps {
    queries: string[];
}

/**
 * 実行された検索クエリを折りたたみ式で表示
 */
export function SearchQueries({ queries }: SearchQueriesProps) {
    if (!queries || queries.length === 0) return null;

    return (
        <details className="mt-2 mb-3">
            <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                🔍 検索クエリ ({queries.length}件)
            </summary>
            <ul className="mt-1 ml-4 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {queries.map((q, i) => (
                    <li key={i} className="list-disc">{q}</li>
                ))}
            </ul>
        </details>
    );
}
