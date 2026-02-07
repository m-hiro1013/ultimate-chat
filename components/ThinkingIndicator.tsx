/**
 * 思考中インジケータコンポーネント
 * 検索中、URL読み取り中、品質チェック中など、各ステップの進捗を表示
 */

'use client';

interface ThinkingIndicatorProps {
    isThinking: boolean;
    status?: 'thinking' | 'searching' | 'reading' | 'analyzing';
}

/**
 * AIの思考状態をアニメーションで表示
 */
export function ThinkingIndicator({ isThinking, status = 'thinking' }: ThinkingIndicatorProps) {
    if (!isThinking) {
        return null;
    }

    const statusConfig = {
        thinking: {
            label: '考え中...',
            icon: '🤔',
            color: 'bg-purple-500',
        },
        searching: {
            label: 'Web検索中...',
            icon: '🔍',
            color: 'bg-blue-500',
        },
        reading: {
            label: 'ページ読み取り中...',
            icon: '📖',
            color: 'bg-green-500',
        },
        analyzing: {
            label: '情報を分析中...',
            icon: '🧠',
            color: 'bg-orange-500',
        },
    };

    const config = statusConfig[status];

    return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 animate-pulse">
            {/* ステータスアイコン */}
            <span className="text-2xl">{config.icon}</span>

            {/* ステータステキスト */}
            <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {config.label}
                </p>
            </div>

            {/* ローディングドット */}
            <div className="flex gap-1">
                <span
                    className={`w-2 h-2 rounded-full ${config.color} animate-bounce`}
                    style={{ animationDelay: '0ms' }}
                />
                <span
                    className={`w-2 h-2 rounded-full ${config.color} animate-bounce`}
                    style={{ animationDelay: '150ms' }}
                />
                <span
                    className={`w-2 h-2 rounded-full ${config.color} animate-bounce`}
                    style={{ animationDelay: '300ms' }}
                />
            </div>
        </div>
    );
}
