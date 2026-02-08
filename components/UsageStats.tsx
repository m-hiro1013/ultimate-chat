'use client';

import React from 'react';
import { TokenUsage } from '@/types';

interface UsageStatsProps {
    usage: TokenUsage;
}

// Gemini 3 Flash の概算料金（2024/05時点、Flash 1.5参考）
// Input: $0.35 / 1M tokens
// Output: $1.05 / 1M tokens
const COST_PER_1M_INPUT = 0.35;
const COST_PER_1M_OUTPUT = 1.05;

/**
 * トークン使用量とコストを表示するコンポーネント
 * GENSPARK 1.6 準拠
 */
export function UsageStats({ usage }: UsageStatsProps) {
    const inputCost = (usage.promptTokens / 1_000_000) * COST_PER_1M_INPUT;
    const outputCost = (usage.completionTokens / 1_000_000) * COST_PER_1M_OUTPUT;
    const totalCost = inputCost + outputCost;

    // 使用割合の計算 (例として 128k を上限の 100% とする)
    const LIMIT = 128_000;
    const promptPercent = Math.min((usage.promptTokens / LIMIT) * 100, 100);
    const completionPercent = Math.min((usage.completionTokens / LIMIT) * 100, 100);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                    <span className="font-semibold text-blue-500">Input:</span>
                    <span>{usage.promptTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="font-semibold text-green-500">Output:</span>
                    <span>{usage.completionTokens.toLocaleString()} tokens</span>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                    <span className="font-semibold text-purple-500">Total:</span>
                    <span>{usage.totalTokens.toLocaleString()} tokens</span>
                </div>
            </div>

            <div className="flex-1 max-w-xs flex flex-col gap-1 px-4">
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Session Usage</span>
                    <span>{Math.round(promptPercent + completionPercent)}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${promptPercent}%` }}
                    />
                    <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${completionPercent}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-gray-500">Est. Cost:</span>
                <span className="font-mono font-bold text-gray-700 dark:text-gray-200">
                    ${totalCost.toFixed(5)}
                </span>
            </div>
        </div>
    );
}
