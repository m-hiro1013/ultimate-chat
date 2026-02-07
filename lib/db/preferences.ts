/**
 * ユーザー設定CRUD操作
 * 長期記憶としてユーザーの好みを永続化
 */

import { db } from './schema';
import type { UserPreferences } from '@/types';

// デフォルトのユーザー設定ID（単一ユーザー想定）
const DEFAULT_USER_ID = 'default';

/**
 * デフォルトのユーザー設定
 */
const DEFAULT_PREFERENCES: UserPreferences = {
    id: DEFAULT_USER_ID,
    language: 'ja',
    codingStyle: 'typescript',
    preferredStack: ['next.js', 'tailwindcss', 'typescript'],
    customInstructions: '',
    updatedAt: new Date(),
};

/**
 * ユーザー設定を取得（なければ作成）
 * @returns ユーザー設定
 */
export async function getPreferences(): Promise<UserPreferences> {
    const existing = await db.preferences.get(DEFAULT_USER_ID);

    if (existing) {
        return existing;
    }

    // 初回はデフォルト設定を作成
    await db.preferences.add(DEFAULT_PREFERENCES);
    return DEFAULT_PREFERENCES;
}

/**
 * ユーザー設定を更新
 * @param updates - 更新するフィールド
 * @returns 更新後のユーザー設定
 */
export async function updatePreferences(
    updates: Partial<Omit<UserPreferences, 'id' | 'updatedAt'>>
): Promise<UserPreferences> {
    const existing = await getPreferences();

    const updated: UserPreferences = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
    };

    await db.preferences.put(updated);
    return updated;
}

/**
 * カスタムインストラクションを更新
 * @param instructions - カスタムインストラクション
 */
export async function updateCustomInstructions(instructions: string): Promise<void> {
    await updatePreferences({ customInstructions: instructions });
}

/**
 * 優先スタックを更新
 * @param stack - 技術スタック配列
 */
export async function updatePreferredStack(stack: string[]): Promise<void> {
    await updatePreferences({ preferredStack: stack });
}

/**
 * コーディングスタイルを更新
 * @param style - コーディングスタイル
 */
export async function updateCodingStyle(style: string): Promise<void> {
    await updatePreferences({ codingStyle: style });
}

/**
 * 言語設定を更新
 * @param language - 言語コード（ja, en等）
 */
export async function updateLanguage(language: string): Promise<void> {
    await updatePreferences({ language });
}

/**
 * ユーザー設定を長期記憶文字列に変換
 * システムプロンプトに注入する形式
 * @returns 長期記憶文字列
 */
export async function getLongTermMemoryString(): Promise<string> {
    const prefs = await getPreferences();

    const parts: string[] = [];

    if (prefs.language) {
        parts.push(`- 言語設定: ${prefs.language === 'ja' ? '日本語' : prefs.language}`);
    }

    if (prefs.codingStyle) {
        parts.push(`- コーディングスタイル: ${prefs.codingStyle}`);
    }

    if (prefs.preferredStack.length > 0) {
        parts.push(`- よく使う技術スタック: ${prefs.preferredStack.join(', ')}`);
    }

    if (prefs.customInstructions) {
        parts.push(`- カスタムインストラクション:\n${prefs.customInstructions}`);
    }

    return parts.join('\n');
}

/**
 * ユーザー設定をリセット
 */
export async function resetPreferences(): Promise<void> {
    await db.preferences.put({
        ...DEFAULT_PREFERENCES,
        updatedAt: new Date(),
    });
}
