import { InlineSuggestion } from '.';

interface SuggestionPayloadObject {
	replace?: unknown;
	text?: unknown;
}

function stripOuterFence(raw: string): string {
	return raw.replace(/^```[\w-]*\n?/, '').replace(/\n?```\s*$/, '');
}

function tryParseJSONObject(value: string): SuggestionPayloadObject | undefined {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			const record = parsed as SuggestionPayloadObject;
			if ('replace' in record || 'text' in record) {
				return record;
			}
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function extractBalancedObjectCandidates(
	text: string,
	maxCandidates = 64,
): string[] {
	const candidates: string[] = [];

	for (let start = 0; start < text.length; start++) {
		if (text[start] !== '{') {
			continue;
		}

		let depth = 0;
		let inString = false;
		let escaped = false;

		for (let i = start; i < text.length; i++) {
			const ch = text[i];

			if (inString) {
				if (escaped) {
					escaped = false;
					continue;
				}
				if (ch === '\\') {
					escaped = true;
					continue;
				}
				if (ch === '"') {
					inString = false;
				}
				continue;
			}

			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === '{') {
				depth += 1;
				continue;
			}
			if (ch === '}') {
				depth -= 1;
				if (depth === 0) {
					candidates.push(text.slice(start, i + 1));
					break;
				}
				if (depth < 0) {
					break;
				}
			}
		}

		if (candidates.length >= maxCandidates) {
			break;
		}
	}

	return candidates;
}

function parseEscapedChar(ch: string): string {
	switch (ch) {
		case 'n':
			return '\n';
		case 'r':
			return '\r';
		case 't':
			return '\t';
		case '"':
			return '"';
		case "'":
			return "'";
		case '\\':
			return '\\';
		default:
			return ch;
	}
}

function extractLooseQuotedValue(raw: string, key: string): string | undefined {
	const keyPattern = new RegExp(`["']${key}["']\\s*:\\s*(["'])`);
	const match = keyPattern.exec(raw);
	if (match === null) {
		return undefined;
	}

	const quote = match[1];
	let index = match.index + match[0].length;
	let value = '';
	let escaped = false;

	for (; index < raw.length; index++) {
		const ch = raw[index];
		if (escaped) {
			value += parseEscapedChar(ch);
			escaped = false;
			continue;
		}
		if (ch === '\\') {
			escaped = true;
			continue;
		}
		if (ch === quote) {
			return value;
		}
		value += ch;
	}

	return undefined;
}

function extractLoosePayload(raw: string): SuggestionPayloadObject | undefined {
	const replaceMatch = raw.match(/["']replace["']\s*:\s*(-?\d+)/);
	const text = extractLooseQuotedValue(raw, 'text');
	if (replaceMatch === null && text === undefined) {
		return undefined;
	}

	const replace =
		replaceMatch === null ? 0 : Number.parseInt(replaceMatch[1], 10);
	return {
		replace: Number.isFinite(replace) ? replace : 0,
		text: text ?? '',
	};
}

function resolvePayloadObject(raw: string): SuggestionPayloadObject | undefined {
	const unfenced = stripOuterFence(raw).trim();

	const direct = tryParseJSONObject(unfenced);
	if (direct !== undefined) {
		return direct;
	}

	const candidates = extractBalancedObjectCandidates(unfenced);
	for (const candidate of candidates) {
		const parsed = tryParseJSONObject(candidate);
		if (parsed !== undefined) {
			return parsed;
		}
	}

	return extractLoosePayload(unfenced);
}

function toInlineSuggestion(
	payload: SuggestionPayloadObject,
	maxReplaceChars: number,
): InlineSuggestion {
	const replaceRaw = Number(payload.replace ?? 0);
	const replaceLength = Number.isFinite(replaceRaw)
		? Math.max(0, Math.min(maxReplaceChars, Math.floor(replaceRaw)))
		: 0;

	return {
		text: typeof payload.text === 'string' ? payload.text : '',
		replaceLength,
	};
}

export function parseSuggestionPayload(
	raw: string,
	maxReplaceChars: number,
	parsePlainText: (content: string) => string,
): InlineSuggestion {
	const payload = resolvePayloadObject(raw);
	if (payload !== undefined) {
		return toInlineSuggestion(payload, maxReplaceChars);
	}

	return {
		text: parsePlainText(raw),
		replaceLength: 0,
	};
}
