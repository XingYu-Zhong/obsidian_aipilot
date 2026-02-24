import { generateText } from 'ai';
import { Notice, requestUrl } from 'obsidian';
import TextComplete from 'src/main';
import { APIClient, ConnectionResult } from '.';
import { getContext } from './prompts/context';
import { PromptGenerator } from './prompts/generator';
import { Provider, resolveModel } from './provider';
import { TextCompleteSettings } from 'src/types';

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	try {
		return JSON.stringify(error);
	} catch {
		return 'Unknown error';
	}
}

function trimOrUndefined(value?: string): string | undefined {
	const trimmed = value?.trim();
	return trimmed === '' ? undefined : trimmed;
}

function withoutTrailingSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

function extractMessageText(content: unknown): string {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === 'string') {
					return part;
				}
				if (!part || typeof part !== 'object') {
					return '';
				}
				const value = part as { text?: unknown; content?: unknown };
				if (typeof value.text === 'string') {
					return value.text;
				}
				if (typeof value.content === 'string') {
					return value.content;
				}
				return '';
			})
			.join('');
	}

	return '';
}

function trimByCursorBoundary(
	candidate: string,
	prefix: string,
	suffix: string,
): string {
	let result = candidate;
	if (result === '') {
		return result;
	}

	// Remove overlap with the end of prefix.
	const maxPrefixOverlap = Math.min(prefix.length, result.length);
	for (let len = maxPrefixOverlap; len > 0; len--) {
		if (prefix.slice(prefix.length - len) === result.slice(0, len)) {
			result = result.slice(len);
			break;
		}
	}

	// Remove overlap with the beginning of suffix.
	const maxSuffixOverlap = Math.min(suffix.length, result.length);
	for (let len = maxSuffixOverlap; len > 0; len--) {
		if (suffix.slice(0, len) === result.slice(result.length - len)) {
			result = result.slice(0, result.length - len);
			break;
		}
	}

	return result;
}

type ListStyle =
	| { kind: 'ordered'; indent: string; baseNumber: number }
	| { kind: 'unordered'; indent: string; marker: '-' | '*' | '+' }
	| { kind: 'task'; indent: string; marker: '-' | '*' | '+' };

function inferListStyle(prefix: string): ListStyle | undefined {
	const lines = prefix.split('\n').slice(-40).reverse();
	for (const line of lines) {
		const task = line.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+/);
		if (task !== null) {
			return {
				kind: 'task',
				indent: task[1],
				marker: task[2] as '-' | '*' | '+',
			};
		}

		const ordered = line.match(/^(\s*)(\d+)\.\s+/);
		if (ordered !== null) {
			return {
				kind: 'ordered',
				indent: ordered[1],
				baseNumber: Number(ordered[2]),
			};
		}

		const unordered = line.match(/^(\s*)([-*+])\s+/);
		if (unordered !== null) {
			return {
				kind: 'unordered',
				indent: unordered[1],
				marker: unordered[2] as '-' | '*' | '+',
			};
		}
	}

	return undefined;
}

function normalizeListCompletion(text: string, style: ListStyle): string {
	const lines = text.split('\n');
	let orderedCounter =
		style.kind === 'ordered' ? Math.max(1, style.baseNumber + 1) : 1;

	const normalized = lines.map((line) => {
		const listLike = line.match(/^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?(.*)$/);
		if (listLike === null) {
			return line;
		}

		const content = listLike[4];
		switch (style.kind) {
			case 'ordered': {
				const next = `${style.indent}${orderedCounter}. ${content}`;
				orderedCounter += 1;
				return next;
			}
			case 'unordered':
				return `${style.indent}${style.marker} ${content}`;
			case 'task':
				return `${style.indent}${style.marker} [ ] ${content}`;
		}
	});

	return normalized.join('\n');
}

function normalizeCompletionByContext(
	text: string,
	prefix: string,
	suffix: string,
): string {
	let normalized = text;
	const context = getContext(prefix, suffix);

	// Models occasionally wrap code completions with extra fences.
	if (context === 'code-block') {
		normalized = normalized.replace(/^```[\w-]*\n?/, '').replace(/\n?```\s*$/, '');
	}

	// Models occasionally wrap math completions with extra math delimiters.
	if (context === 'math-block') {
		normalized = normalized.replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '');
		normalized = normalized.replace(/^\$\s*/, '').replace(/\s*\$$/, '');
	}

	// Heading completion should provide title fragment, not heading marker.
	if (context === 'heading') {
		normalized = normalized.replace(/^\s*#{1,6}\s+/, '');
	}

	if (context === 'list-item') {
		const style = inferListStyle(prefix);
		if (style !== undefined) {
			normalized = normalizeListCompletion(normalized, style);
		}
	}

	return normalized;
}

function finalizeCompletionText(text: string, prefix: string, suffix: string): string {
	const contextual = normalizeCompletionByContext(text, prefix, suffix);
	const deOverlapped = trimByCursorBoundary(contextual, prefix, suffix);
	return deOverlapped;
}

function getProviderConfig(settings: TextCompleteSettings, provider: Provider) {
	switch (provider) {
		case 'openai':
			return settings.providers.openai;
		case 'anthropic':
			return settings.providers.anthropic;
		case 'google':
			return settings.providers.google;
		case 'mistral':
			return settings.providers.mistral;
		case 'deepseek':
			return settings.providers.deepseek;
		case 'zenmux':
			return settings.providers.zenmux;
		case 'custom-openai':
			return settings.providers.customOpenAI;
	}
}

function buildConnectionDetails(
	settings: TextCompleteSettings,
	meta?: {
		text?: string;
		finishReason?: string;
		responseModel?: string;
		httpStatus?: number;
		rawPreview?: string;
	},
) {
	const provider = settings.completions.provider;
	const model = settings.completions.model?.trim() || '(empty)';
	const providerConfig = getProviderConfig(settings, provider);
	const apiKeyState = providerConfig.apiKey?.trim() ? 'set' : 'empty';
	const baseURL = providerConfig.baseUrl?.trim() || '(default)';
	const text = meta?.text ?? '';
	const parts = [
		`provider=${provider}`,
		`model=${model}`,
		`baseURL=${baseURL}`,
		`apiKey=${apiKeyState}`,
		`textLength=${text.length}`,
		`textPreview=${JSON.stringify(text.slice(0, 80))}`,
		meta?.finishReason ? `finishReason=${meta.finishReason}` : undefined,
		meta?.responseModel ? `responseModel=${meta.responseModel}` : undefined,
		meta?.httpStatus != null ? `httpStatus=${meta.httpStatus}` : undefined,
		meta?.rawPreview ? `rawPreview=${JSON.stringify(meta.rawPreview.slice(0, 160))}` : undefined,
	];
	return parts.filter((part): part is string => part != null).join(' | ');
}

interface ZenmuxChatResult {
	text: string;
	finishReason?: string;
	responseModel?: string;
	httpStatus: number;
	rawPreview: string;
}

export class AISDKClient implements APIClient {
	constructor(
		private readonly generator: PromptGenerator,
		private readonly plugin: TextComplete,
	) {}

	async fetchCompletions(prefix: string, suffix: string) {
		const { settings } = this.plugin;

		try {
			const prompt = this.generator.generateCompletionsPrompt(prefix, suffix);
			if (settings.completions.provider === 'zenmux') {
				const result = await this.requestZenmuxChat(prompt, {
					maxTokens: settings.completions.maxTokens,
					temperature: settings.completions.temperature,
				});
				const parsed = finalizeCompletionText(
					this.generator.parseResponse(result.text),
					prefix,
					suffix,
				);
				return parsed.trim().length > 0 ? parsed : undefined;
			}

			const model = resolveModel(settings);

			const { text } = await generateText({
				model,
				prompt,
				maxOutputTokens: settings.completions.maxTokens,
				temperature: settings.completions.temperature,
				stopSequences: ['\n\n\n'],
			});

			const parsed = finalizeCompletionText(
				this.generator.parseResponse(text),
				prefix,
				suffix,
			);
			return parsed.trim().length > 0 ? parsed : undefined;
		} catch (error) {
			console.error(error);
			new Notice('Failed to fetch completions. Please verify provider config.');
			return undefined;
		}
	}

	private async requestZenmuxChat(
		prompt: string,
		options: {
			maxTokens: number;
			temperature: number;
		},
	): Promise<ZenmuxChatResult> {
		const { settings } = this.plugin;
		const apiKey = trimOrUndefined(settings.providers.zenmux.apiKey);
		const baseURL =
			trimOrUndefined(settings.providers.zenmux.baseUrl) ??
			'https://zenmux.ai/api/v1';
		const model = settings.completions.model?.trim();

		if (!apiKey) {
			throw new Error('Zenmux API key is empty.');
		}
		if (!model) {
			throw new Error('Zenmux model id is empty.');
		}

		const url = `${withoutTrailingSlash(baseURL)}/chat/completions`;
		const requestedMaxTokens = Math.max(options.maxTokens, 256);
		const response = await requestUrl({
			url,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: prompt }],
				// Zenmux/stepfun style models may spend many tokens in `reasoning`.
				// A low limit (e.g. 64) can return empty `content`.
				max_tokens: requestedMaxTokens,
				temperature: options.temperature,
			}),
			throw: false,
		});

		const rawPreview = response.text.replace(/\s+/g, ' ').slice(0, 400);

		if (response.status >= 400) {
			throw new Error(
				`Zenmux HTTP ${response.status}: ${rawPreview || 'empty response body'}`,
			);
		}

		const body =
			response.json ??
			(response.text.trim().length > 0 ? JSON.parse(response.text) : {});
		const firstChoice = Array.isArray(body?.choices) ? body.choices[0] : undefined;
		const text = extractMessageText(
			(firstChoice as { message?: { content?: unknown } } | undefined)?.message
				?.content,
		);
		const finishReason =
			typeof (firstChoice as { finish_reason?: unknown } | undefined)?.finish_reason ===
			'string'
				? ((firstChoice as { finish_reason?: string }).finish_reason ?? undefined)
				: undefined;
		const responseModel =
			typeof (body as { model?: unknown }).model === 'string'
				? ((body as { model?: string }).model ?? undefined)
				: undefined;

		return {
			text,
			finishReason,
			responseModel,
			httpStatus: response.status,
			rawPreview,
		};
	}

	async testConnection(): Promise<ConnectionResult> {
		const settings = this.plugin.settings;
		try {
			if (settings.completions.provider === 'zenmux') {
				const result = await this.requestZenmuxChat('Please reply with exactly: hi', {
					maxTokens: 256,
					temperature: 0,
				});
				const details = buildConnectionDetails(settings, {
					text: result.text,
					finishReason: result.finishReason,
					responseModel: result.responseModel,
					httpStatus: result.httpStatus,
					rawPreview: result.rawPreview,
				});
				const reply = result.text.trim().toLowerCase();
				if (reply.length === 0) {
					console.error('Connection test failed: empty text', { details });
					return {
						ok: false,
						error: 'Provider responded with empty text.',
						details,
					};
				}
				if (!reply.includes('hi')) {
					console.error('Connection test failed: unexpected reply', { details });
					return {
						ok: false,
						error: `Unexpected reply: "${result.text.trim()}"`,
						details,
					};
				}
				return { ok: true, details };
			}

			const model = resolveModel(settings);
			const result = await generateText({
				model,
				prompt: 'Please reply with exactly: hi',
				maxOutputTokens: 64,
				temperature: 0,
			});
			const text = result.text;
			const finishReason =
				typeof (result as { finishReason?: unknown }).finishReason === 'string'
					? (result as { finishReason?: string }).finishReason
					: undefined;
			const responseModel =
				typeof (result as { response?: { modelId?: unknown; model?: unknown } }).response
					?.modelId === 'string'
					? ((result as { response?: { modelId?: string } }).response?.modelId ?? undefined)
					: typeof (result as { response?: { modelId?: unknown; model?: unknown } })
								.response?.model === 'string'
						? ((result as { response?: { model?: string } }).response?.model ?? undefined)
						: undefined;
			const details = buildConnectionDetails(settings, {
				text,
				finishReason,
				responseModel,
			});
			const reply = text.trim().toLowerCase();
			if (reply.length === 0) {
				console.error('Connection test failed: empty text', { details });
				return {
					ok: false,
					error: 'Provider responded with empty text.',
					details,
				};
			}
			if (!reply.includes('hi')) {
				console.error('Connection test failed: unexpected reply', { details });
				return {
					ok: false,
					error: `Unexpected reply: "${text.trim()}"`,
					details,
				};
			}
			return { ok: true, details };
		} catch (error) {
			const details = buildConnectionDetails(settings);
			console.error('Connection test threw error', { error, details });
			return {
				ok: false,
				error: getErrorMessage(error),
				details,
			};
		}
	}
}
