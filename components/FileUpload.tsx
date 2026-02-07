/**
 * ファイルアップロードコンポーネント
 * ドラッグ&ドロップ対応、画像プレビュー付き
 */

'use client';

import { useState, useCallback, useRef } from 'react';

interface FileUploadProps {
    onFileSelect: (file: File, dataUrl: string) => void;
    accept?: string;
    maxSize?: number; // bytes
}

interface FilePreview {
    file: File;
    dataUrl: string;
}

/**
 * ドラッグ&ドロップ対応のファイルアップロード
 */
export function FileUpload({
    onFileSelect,
    accept = 'image/*,.pdf,.txt,.md,.js,.ts,.tsx,.jsx,.py,.json',
    maxSize = 10 * 1024 * 1024, // デフォルト10MB
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<FilePreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ファイルを処理
    const processFile = useCallback(
        async (file: File) => {
            setError(null);

            // サイズチェック
            if (file.size > maxSize) {
                setError(`ファイルサイズが大きすぎます（最大${Math.round(maxSize / 1024 / 1024)}MB）`);
                return;
            }

            // Data URLに変換
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                setPreview({ file, dataUrl });
                onFileSelect(file, dataUrl);
            };
            reader.readAsDataURL(file);
        },
        [maxSize, onFileSelect]
    );

    // ドラッグイベントハンドラ
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const file = e.dataTransfer.files[0];
            if (file) {
                processFile(file);
            }
        },
        [processFile]
    );

    // ファイル選択ハンドラ
    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                processFile(file);
            }
        },
        [processFile]
    );

    // プレビューをクリア
    const clearPreview = useCallback(() => {
        setPreview(null);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    }, []);

    return (
        <div className="relative">
            {/* プレビュー表示 */}
            {preview && (
                <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-2">
                    {/* 画像プレビュー */}
                    {preview.file.type.startsWith('image/') && (
                        <img
                            src={preview.dataUrl}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded"
                        />
                    )}

                    {/* ファイル情報 */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-700 dark:text-gray-300">
                            {preview.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                            {(preview.file.size / 1024).toFixed(1)} KB
                        </p>
                    </div>

                    {/* 削除ボタン */}
                    <button
                        onClick={clearPreview}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                        <XIcon className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            )}

            {/* エラー表示 */}
            {error && (
                <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded">
                    {error}
                </div>
            )}

            {/* ドロップエリア（プレビューがない場合のみ） */}
            {!preview && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`
            p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${isDragging
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }
          `}
                >
                    <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                        <UploadIcon className="w-8 h-8" />
                        <p className="text-sm text-center">
                            ファイルをドラッグ&ドロップ
                            <br />
                            <span className="text-xs">またはクリックして選択</span>
                        </p>
                    </div>
                </div>
            )}

            {/* 隠しinput */}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}

// アップロードアイコン
function UploadIcon({ className }: { className?: string }) {
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
        </svg>
    );
}

// Xアイコン
function XIcon({ className }: { className?: string }) {
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
                d="M6 18L18 6M6 6l12 12"
            />
        </svg>
    );
}
