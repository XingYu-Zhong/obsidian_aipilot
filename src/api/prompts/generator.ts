import TextComplete from 'src/main';
import { BLOCK_QUOTE_PROMPT } from './completions/block-quote';
import { CODE_BLOCK_PROMPT } from './completions/code-block';
import { HEADING_PROMPT } from './completions/heading';
import { LIST_ITEM_PROMPT } from './completions/list-item';
import { MATH_BLOCK_PROMPT } from './completions/math-block';
import { PARAGRAPH_PROMPT } from './completions/paragraph';
import { Context, getContext, getLanguage } from './context';
import { DEFAULT_ROLE_PLAY } from './role-play';

const COMPLETIONS_SYSTEM_PROMPTS: Record<Context, string> = {
	heading: HEADING_PROMPT.system,
	paragraph: PARAGRAPH_PROMPT.system,
	'list-item': LIST_ITEM_PROMPT.system,
	'block-quote': BLOCK_QUOTE_PROMPT.system,
	'math-block': MATH_BLOCK_PROMPT.system,
	'code-block': CODE_BLOCK_PROMPT.system,
};

const OUTPUT_PROTOCOL = [
	'OUTPUT PROTOCOL:',
	'1) Return only the insertion text.',
	'2) Do NOT output wrappers/tags such as <INSERT>, </INSERT>, <LANGUAGE>, <THOUGHT>.',
	'3) Do NOT explain your reasoning.',
	'4) The insertion point is exactly the boundary between PREFIX and SUFFIX.',
	'5) Do NOT repeat trailing PREFIX or leading SUFFIX text.',
	'6) If context_type is list-item, preserve the existing list style and indentation.',
].join('\n');

const INPUT_SCHEMA = [
	'INPUT SCHEMA:',
	'- context_type: markdown structural context at cursor',
	'- language_hint: language to follow (for code blocks)',
	'- prefix: full text before cursor (truncated window)',
	'- suffix: full text after cursor (truncated window)',
].join('\n');

function stripLegacyFormatInstructions(system: string): string {
	const marker = 'Your answer must have the following format:';
	const index = system.indexOf(marker);
	return (index === -1 ? system : system.slice(0, index)).trim();
}

function stripBoundaryBlankLines(value: string): string {
	return value
		.replace(/^(?:[ \t]*\r?\n)+/, '')
		.replace(/(?:\r?\n[ \t]*)+$/, '');
}

function removeMetaHintLines(value: string): string {
	const metaLinePatterns = [
		/按\s*tab\s*键.*接受建议/i,
		/按\s*tab\s*接受/i,
		/补全（?按.*tab.*接受建议）?/i,
		/press\s+tab.*accept/i,
		/completion\s*\(.*tab.*accept/i,
		/accept\s+suggestion/i,
	];

	const lines = value.split('\n');
	const kept = lines.filter((line) => {
		const trimmed = line.trim();
		if (trimmed === '') {
			return true;
		}
		return !metaLinePatterns.some((pattern) => pattern.test(trimmed));
	});
	return kept.join('\n');
}

function buildInputBlock(params: {
	context: Context;
	languageHint: string;
	prefix: string;
	suffix: string;
	listStyleHint?: string;
	listMarkerHint?: string;
}): string {
	const parts = [
		'context_type:',
		params.context,
		'language_hint:',
		params.languageHint,
	];

	if (params.listStyleHint !== undefined) {
		parts.push('list_style_hint:', params.listStyleHint);
	}
	if (params.listMarkerHint !== undefined) {
		parts.push('list_marker_hint:', params.listMarkerHint);
	}

	parts.push(
		'prefix:',
		'<<<PREFIX',
		params.prefix,
		'PREFIX',
		'suffix:',
		'<<<SUFFIX',
		params.suffix,
		'SUFFIX',
	);

	return parts.join('\n');
}

function inferListHints(prefix: string): {
	listStyleHint?: string;
	listMarkerHint?: string;
} {
	const lines = prefix.split('\n').slice(-30).reverse();
	for (const line of lines) {
		const taskMatch = line.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+/);
		if (taskMatch !== null) {
			return {
				listStyleHint: 'task-list',
				listMarkerHint: `${taskMatch[1]}${taskMatch[2]} [ ]`,
			};
		}

		const orderedMatch = line.match(/^(\s*)(\d+)\.\s+/);
		if (orderedMatch !== null) {
			return {
				listStyleHint: 'ordered-list',
				listMarkerHint: `${orderedMatch[1]}${orderedMatch[2]}.`,
			};
		}

		const unorderedMatch = line.match(/^(\s*)([-*+])\s+/);
		if (unorderedMatch !== null) {
			return {
				listStyleHint: 'unordered-list',
				listMarkerHint: `${unorderedMatch[1]}${unorderedMatch[2]}`,
			};
		}
	}

	return {};
}

export class PromptGenerator {
	constructor(private readonly plugin: TextComplete) {}

	generateCompletionsPrompt(prefix: string, suffix: string) {
		const { settings } = this.plugin;

		const context = getContext(prefix, suffix);
		const legacyContextGuideline = stripLegacyFormatInstructions(
			context === 'code-block'
				? COMPLETIONS_SYSTEM_PROMPTS[context].replace(
						'{{LANGUAGE}}',
						getLanguage(prefix, suffix),
					)
				: COMPLETIONS_SYSTEM_PROMPTS[context],
		);

		const windowSize = settings.completions.windowSize;
		const truncatedPrefix = prefix.slice(
			Math.max(0, prefix.length - windowSize / 2),
			prefix.length,
		);
		const truncatedSuffix = suffix.slice(0, windowSize / 2);
		const languageHint = context === 'code-block' ? getLanguage(prefix, suffix) : 'auto';
		const listHints = context === 'list-item' ? inferListHints(prefix) : {};

		const taskInput = buildInputBlock({
			context,
			languageHint,
			prefix: truncatedPrefix,
			suffix: truncatedSuffix,
			listStyleHint: listHints.listStyleHint,
			listMarkerHint: listHints.listMarkerHint,
		});

		const rolePlay = this.plugin.settings.prompts.rolePlay.trim();

		return [
			rolePlay === '' ? DEFAULT_ROLE_PLAY : rolePlay,
			legacyContextGuideline,
			OUTPUT_PROTOCOL,
			INPUT_SCHEMA,
			'TASK INPUT:',
			taskInput,
			'Now return only the insertion text.',
		]
			.filter((part) => part !== '')
			.join('\n\n');
	}

	parseResponse(content: string) {
		const normalized = content
			.replace(/<\s*INSERT\s*\/\s*>/gi, '<INSERT>')
			.replace(/<\s*\/\s*INSERT\s*>/gi, '</INSERT>');

		const wrappedFence = normalized.match(/^```[\w-]*\n([\s\S]*?)\n```\s*$/);
		const unfenced = wrappedFence !== null ? wrappedFence[1] : normalized;

		const betweenTags = unfenced.match(
			/<\s*INSERT\s*>([\s\S]*?)<\s*\/\s*INSERT\s*>/i,
		);
		let candidate = betweenTags !== null ? betweenTags[1] : unfenced;

		const openTagMatch = candidate.match(/<\s*INSERT\s*>/i);
		if (openTagMatch !== null) {
			candidate = candidate.slice(openTagMatch.index! + openTagMatch[0].length);
		}

		candidate = candidate
			.replace(/<\s*\/?\s*(INSERT|LANGUAGE|THOUGHTS?|OUTPUT|ANSWER|RESPONSE)\s*>/gi, '')
			.replace(/^(?:inserted text|insertion|output|completion)\s*:\s*/i, '')
			.replace(/^(?:here(?:'s| is)\s+the\s+(?:insertion|completion)\s*:\s*)/i, '');
		candidate = removeMetaHintLines(candidate);

		return stripBoundaryBlankLines(candidate);
	}
}
