'use client';

import { useState } from 'react';

interface ThinkingBlockProps {
    content: string;
}

/**
 * AIの思考プロセスを表示する折りたたみコンポーネント
 */
export function ThinkingBlock({ content }: ThinkingBlockProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="my-2 border border-gray-700 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 text-sm text-gray-400 transition-colors"
            >
                <span className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    ▶
                </span>
                <span>🧠 思考プロセス</span>
            </button>
            {isOpen && (
                <div className="px-3 py-2 text-xs text-gray-500 bg-gray-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {content}
                </div>
            )}
        </div>
    );
}
