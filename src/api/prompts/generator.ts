import TextComplete from 'src/main';
import { SuggestionTask } from '..';
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
	'1) Return a JSON object only, without markdown/code fences.',
	'2) JSON schema: {"replace": number, "text": string}.',
	'3) replace means how many characters to replace from the beginning of EDIT_TARGET_SUFFIX.',
	'4) replace must be between 0 and MAX_REPLACE_CHARS.',
	'5) text is the final replacement text to insert at cursor.',
	'6) If no replacement is needed, use replace=0 and provide normal continuation in text.',
	'7) Do NOT output wrappers/tags such as <INSERT>, </INSERT>, <LANGUAGE>, <THOUGHT>.',
	'8) Do NOT explain your reasoning.',
	'9) The insertion point is exactly the boundary between PREFIX and SUFFIX.',
	'10) Do NOT repeat trailing PREFIX or leading SUFFIX text.',
	'11) If context_type is list-item, preserve the existing list style and indentation.',
	'12) If context_type is list-item, each new item must start on its own new line.',
].join('\n');

const INPUT_SCHEMA = [
	'INPUT SCHEMA:',
	'- edit_instruction: optional, when present indicates edit intent',
	'- recent_edits: recent user edits in the last ~2 seconds',
	'- context_type: markdown structural context at cursor',
	'- language_hint: language to follow (for code blocks)',
	'- prefix: full text before cursor (truncated window)',
	'- suffix: full text after cursor (truncated window)',
].join('\n');

const TASK_PROTOCOL = [
	'TASK PROTOCOL:',
	'- First decide mode automatically:',
	'- Use EDIT MODE when edit_instruction is non-empty, or when a short replacement in EDIT_TARGET_SUFFIX is clearly needed.',
	'- Otherwise use COMPLETION MODE.',
	'- Use recent_edits as high-priority evidence of user intent and writing direction.',
	'- In COMPLETION MODE: continue naturally from cursor and usually set replace=0.',
	'- In EDIT MODE: follow edit_instruction and edit within EDIT_TARGET_SUFFIX.',
	'- In EDIT MODE: replace should normally equal MAX_REPLACE_CHARS.',
	'- In EDIT MODE: preserve unaffected context and output only edited replacement text.',
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
	task: SuggestionTask;
	context: Context;
	languageHint: string;
	prefix: string;
	suffix: string;
	editTargetSuffix: string;
	maxReplaceChars: number;
	listStyleHint?: string;
	listMarkerHint?: string;
}): string {
	const instruction = params.task.instruction?.trim() ?? '';
	const recentEdits = params.task.recentEdits?.trim() ?? '';
	const parts: string[] = [];

	parts.push(
		'edit_instruction:',
		'<<<EDIT_INSTRUCTION',
		instruction,
		'EDIT_INSTRUCTION',
		'recent_edits:',
		'<<<RECENT_EDITS',
		recentEdits,
		'RECENT_EDITS',
	);

	parts.push(
		'context_type:',
		params.context,
		'language_hint:',
		params.languageHint,
	);

	if (params.listStyleHint !== undefined) {
		parts.push('list_style_hint:', params.listStyleHint);
	}
	if (params.listMarkerHint !== undefined) {
		parts.push('list_marker_hint:', params.listMarkerHint);
	}
	parts.push('max_replace_chars:', String(params.maxReplaceChars));

	parts.push(
		'prefix:',
		'<<<PREFIX',
		params.prefix,
		'PREFIX',
		'suffix:',
		'<<<SUFFIX',
		params.suffix,
		'SUFFIX',
		'edit_target_suffix:',
		'<<<EDIT_TARGET_SUFFIX',
		params.editTargetSuffix,
		'EDIT_TARGET_SUFFIX',
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

	generateCompletionsPrompt(
		prefix: string,
		suffix: string,
		task: SuggestionTask = {},
	) {
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

		const configuredMaxReplaceChars = Math.max(
			0,
			settings.completions.replaceWindowSize,
		);
		const requestedMaxReplaceChars = task.maxReplaceChars ?? configuredMaxReplaceChars;
		const maxReplaceChars = Math.max(0, Math.floor(requestedMaxReplaceChars));

		const halfWindow = Math.max(1, Math.floor(settings.completions.windowSize / 2));
		const promptWindow = Math.max(halfWindow, maxReplaceChars);
		const truncatedPrefix = prefix.slice(
			Math.max(0, prefix.length - promptWindow),
			prefix.length,
		);
		const truncatedSuffix = suffix.slice(0, promptWindow);
		const languageHint = context === 'code-block' ? getLanguage(prefix, suffix) : 'auto';
		const listHints = context === 'list-item' ? inferListHints(prefix) : {};
		const boundedMaxReplaceChars = Math.min(maxReplaceChars, truncatedSuffix.length);
		const editTargetSuffix = truncatedSuffix.slice(0, boundedMaxReplaceChars);

		const taskInput = buildInputBlock({
			task,
			context,
			languageHint,
			prefix: truncatedPrefix,
			suffix: truncatedSuffix,
			editTargetSuffix,
			maxReplaceChars: boundedMaxReplaceChars,
			listStyleHint: listHints.listStyleHint,
			listMarkerHint: listHints.listMarkerHint,
		});

		const rolePlay = this.plugin.settings.prompts.rolePlay.trim();

		return [
			rolePlay === '' ? DEFAULT_ROLE_PLAY : rolePlay,
			legacyContextGuideline,
			OUTPUT_PROTOCOL,
			INPUT_SCHEMA,
			TASK_PROTOCOL,
			'TASK INPUT:',
			taskInput,
			'Now return JSON only.',
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
