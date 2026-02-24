// NOTE:
// This context detection module is inspired by j0rd1smit/obsidian-copilot-auto-completion.

// Unicode character \uFFFF is invalid in regular text.
const CURSOR_CHAR = '\uFFFF';

const HEADER_REGEX = /^#+\s.*\uFFFF.*$/m;
const UNORDERED_LIST_REGEX = /^\s*(-|\*)\s.*\uFFFF.*$/m;
const TASK_LIST_REGEX = /^\s*(-|[0-9]+\.) +\[.\]\s.*\uFFFF.*$/m;
const BLOCK_QUOTES_REGEX = /^\s*>.*\uFFFF.*$/m;
const NUMBERED_LIST_REGEX = /^\s*\d+\.\s.*\uFFFF.*$/m;
const MATH_BLOCK_REGEX = /\$\$[\s\S]*?\$\$/g;
const INLINE_MATH_BLOCK_REGEX = /\$[^\n$]+\$/g;
const CODE_BLOCK_REGEX = /```(?<language>[^\n]*)[\s\S]*?```/g;
const INLINE_CODE_BLOCK_REGEX = /`[^`]+`/g;

export const CONTEXTS = [
	'heading',
	'paragraph',
	'list-item',
	'block-quote',
	'math-block',
	'code-block',
] as const;

export const CONTEXTS_NAMES: Record<Context, string> = {
	heading: 'Heading',
	paragraph: 'Paragraph',
	'list-item': 'List Item',
	'block-quote': 'Block Quote',
	'math-block': 'Math Block',
	'code-block': 'Code Block',
};

export type Context = (typeof CONTEXTS)[number];

export function getContext(prefix: string, suffix: string): Context {
	const text = prefix + CURSOR_CHAR + suffix;

	if (HEADER_REGEX.test(text)) {
		return 'heading';
	}
	if (BLOCK_QUOTES_REGEX.test(text)) {
		return 'block-quote';
	}
	if (
		NUMBERED_LIST_REGEX.test(text) ||
		UNORDERED_LIST_REGEX.test(text) ||
		TASK_LIST_REGEX.test(text)
	) {
		return 'list-item';
	}
	if (
		isCursorInBlock(text, MATH_BLOCK_REGEX) ||
		isCursorInBlock(text, INLINE_MATH_BLOCK_REGEX)
	) {
		return 'math-block';
	}
	if (
		isCursorInBlock(text, CODE_BLOCK_REGEX) ||
		isCursorInBlock(text, INLINE_CODE_BLOCK_REGEX)
	) {
		return 'code-block';
	}

	return 'paragraph';
}

export function getLanguage(prefix: string, suffix: string): string {
	const text = prefix + CURSOR_CHAR + suffix;
	if (!isCursorInBlock(text, CODE_BLOCK_REGEX)) {
		return 'plaintext';
	}

	CODE_BLOCK_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null = null;
	while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
		if (match[0].includes(CURSOR_CHAR)) {
			const language = (match.groups?.language ?? '').trim();
			return language === '' ? 'plaintext' : language;
		}
	}
	return 'plaintext';
}

function isCursorInBlock(text: string, regex: RegExp): boolean {
	regex.lastIndex = 0;
	const blocks = text.match(regex);
	if (blocks === null) {
		return false;
	}
	return blocks.some((block) => block.includes(CURSOR_CHAR));
}
