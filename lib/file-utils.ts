/**
 * ファイルユーティリティ
 * MIMEタイプの正確な判定とテキストファイルの処理
 */

/**
 * テキスト系ファイルの拡張子一覧
 * ブラウザのFile.typeが不正確なため、拡張子で判定する
 */
const TEXT_EXTENSIONS = new Set([
    // プログラミング言語
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts',
    'py', 'pyw', 'rb', 'go', 'rs', 'java', 'kt', 'kts',
    'c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'cs', 'swift',
    'php', 'pl', 'pm', 'r', 'R', 'scala', 'clj', 'cljs',
    'lua', 'dart', 'elm', 'ex', 'exs', 'erl', 'hrl',
    'hs', 'lhs', 'v', 'sv', 'vhd', 'vhdl',
    // マークアップ・データ
    'html', 'htm', 'xml', 'xhtml', 'svg',
    'json', 'jsonl', 'ndjson', 'json5',
    'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
    'csv', 'tsv',
    // ドキュメント
    'md', 'mdx', 'markdown', 'txt', 'text', 'rst', 'adoc',
    'tex', 'latex', 'bib',
    // 設定・スクリプト
    'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
    'env', 'env.local', 'env.development', 'env.production',
    'gitignore', 'gitattributes', 'dockerignore',
    'editorconfig', 'prettierrc', 'eslintrc',
    'dockerfile', 'makefile', 'rakefile', 'gemfile',
    // Web
    'css', 'scss', 'sass', 'less', 'styl',
    'graphql', 'gql', 'proto',
    // SQL
    'sql', 'ddl', 'dml',
    // ログ
    'log',
]);

/**
 * ファイルの拡張子を取得（小文字）
 */
function getExtension(fileName: string): string {
    const parts = fileName.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
}

/**
 * ファイル名から特殊なファイルを判定
 * 拡張子がなくてもテキストと判定すべきファイル
 */
const TEXT_FILENAMES = new Set([
    'dockerfile', 'makefile', 'rakefile', 'gemfile',
    'procfile', 'brewfile', 'vagrantfile',
    '.gitignore', '.gitattributes', '.dockerignore',
    '.editorconfig', '.prettierrc', '.eslintrc',
    '.babelrc', '.npmrc', '.nvmrc', '.yarnrc',
    'license', 'licence', 'readme', 'changelog',
    'authors', 'contributors', 'todo', 'copying',
]);

/**
 * テキストファイルかどうかを判定
 * ブラウザのFile.typeではなく、拡張子とファイル名で判定する
 */
export function isTextFile(file: File): boolean {
    // 拡張子で判定
    const ext = getExtension(file.name);
    if (TEXT_EXTENSIONS.has(ext)) return true;

    // ファイル名で判定（拡張子なし特殊ファイル）
    const baseName = file.name.toLowerCase();
    if (TEXT_FILENAMES.has(baseName)) return true;

    // MIMEタイプで判定（ブラウザが正しく設定した場合）
    if (file.type.startsWith('text/')) return true;
    if (file.type === 'application/json') return true;
    if (file.type === 'application/xml') return true;
    if (file.type === 'application/javascript') return true;
    if (file.type === 'application/typescript') return true;

    return false;
}

/**
 * 画像ファイルかどうかを判定
 */
export function isImageFile(file: File): boolean {
    const ext = getExtension(file.name);
    const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico']);
    return file.type.startsWith('image/') || imageExtensions.has(ext);
}

/**
 * PDFファイルかどうかを判定
 */
export function isPdfFile(file: File): boolean {
    return file.type === 'application/pdf' || getExtension(file.name) === 'pdf';
}

/**
 * テキストファイルの内容を読み取り、サイズ制限を適用する
 * 
 * @param file - 読み取るファイル
 * @param maxLength - 最大文字数（デフォルト: 120,000文字 ≈ 30,000-40,000トークン）
 * @returns 処理済みテキスト
 */
export async function readTextFileWithLimit(
    file: File,
    maxLength: number = 120000
): Promise<{ text: string; truncated: boolean; originalLength: number }> {
    const text = await file.text();

    if (text.length <= maxLength) {
        return { text, truncated: false, originalLength: text.length };
    }

    // 先頭80%、末尾15%を保持（中間を省略）
    const headSize = Math.floor(maxLength * 0.80);
    const tailSize = Math.floor(maxLength * 0.15);
    const omittedLength = text.length - headSize - tailSize;

    const truncatedText =
        text.slice(0, headSize) +
        `\n\n[... ファイルが大きいため中間部分を省略しました (約${omittedLength.toLocaleString()}文字) ...]\n\n` +
        text.slice(-tailSize);

    return {
        text: truncatedText,
        truncated: true,
        originalLength: text.length,
    };
}
