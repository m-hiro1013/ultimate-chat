/**
 * 設定パネルコンポーネント
 * ユーザー設定（長期記憶）を管理するUI
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    getPreferences,
    updatePreferences,
    resetPreferences,
} from '@/lib/db/preferences';
import type { UserPreferences } from '@/types';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 設定パネル
 * ユーザーの好み、技術スタック、カスタムインストラクションを設定
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // 設定を読み込み
    useEffect(() => {
        if (isOpen) {
            getPreferences().then(setPreferences);
        }
    }, [isOpen]);

    // 設定を保存
    const handleSave = useCallback(async () => {
        if (!preferences) return;

        setSaving(true);
        try {
            await updatePreferences({
                language: preferences.language,
                codingStyle: preferences.codingStyle,
                preferredStack: preferences.preferredStack,
                customInstructions: preferences.customInstructions,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('[Settings] Save failed:', error);
        } finally {
            setSaving(false);
        }
    }, [preferences]);

    // 設定をリセット
    const handleReset = useCallback(async () => {
        if (!confirm('設定をデフォルトに戻しますか？')) return;

        try {
            await resetPreferences();
            const newPrefs = await getPreferences();
            setPreferences(newPrefs);
        } catch (error) {
            console.error('[Settings] Reset failed:', error);
        }
    }, []);

    // 技術スタックを更新
    const handleStackChange = useCallback((value: string) => {
        if (!preferences) return;
        const stack = value.split(',').map(s => s.trim()).filter(Boolean);
        setPreferences({ ...preferences, preferredStack: stack });
    }, [preferences]);

    if (!isOpen) return null;

    return (
        <>
            {/* オーバーレイ */}
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
            />

            {/* パネル本体 */}
            <div
                className="fixed inset-y-0 right-0 w-full max-w-md bg-gray-900 border-l border-gray-800 z-50 flex flex-col"
                role="dialog"
                aria-modal="true"
                aria-label="設定パネル"
            >
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-white">設定</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                        aria-label="閉じる"
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {preferences ? (
                        <>
                            {/* 言語設定 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    言語
                                </label>
                                <select
                                    value={preferences.language}
                                    onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ja">日本語</option>
                                    <option value="en">English</option>
                                </select>
                            </div>

                            {/* コーディングスタイル */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    コーディングスタイル
                                </label>
                                <select
                                    value={preferences.codingStyle}
                                    onChange={(e) => setPreferences({ ...preferences, codingStyle: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="typescript">TypeScript</option>
                                    <option value="javascript">JavaScript</option>
                                    <option value="python">Python</option>
                                </select>
                            </div>

                            {/* 優先技術スタック */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    よく使う技術スタック（カンマ区切り）
                                </label>
                                <input
                                    type="text"
                                    value={preferences.preferredStack.join(', ')}
                                    onChange={(e) => handleStackChange(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="next.js, tailwindcss, typescript"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    例: next.js, tailwindcss, typescript, prisma
                                </p>
                            </div>

                            {/* カスタムインストラクション */}
                            <div className="pt-4 border-t border-gray-800">
                                <label className="block text-sm font-bold text-blue-400 mb-3 uppercase tracking-wider">
                                    カスタムインストラクション
                                </label>
                                <textarea
                                    value={preferences.customInstructions}
                                    onChange={(e) => setPreferences({ ...preferences, customInstructions: e.target.value })}
                                    rows={10}
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white resize-none focus:ring-2 focus:ring-blue-500 custom-scrollbar"
                                    placeholder="AIへの追加指示を入力（例: 常にコードにコメントを付けて、変数名は日本語で説明して）"
                                />
                                <p className="mt-2 text-xs text-gray-500 italic">
                                    ここに書いた内容は、すべての会話でAIに伝えられます
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-32">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        デフォルトに戻す
                    </button>
                    <div className="flex items-center gap-2">
                        {saved && (
                            <span className="text-sm text-green-400">保存しました！</span>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                        >
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// 閉じるアイコン
function CloseIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}
