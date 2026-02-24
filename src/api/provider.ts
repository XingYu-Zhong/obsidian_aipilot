import { TextCompleteSettings } from 'src/types';

export const PROVIDERS = [
	'openai',
	'anthropic',
	'google',
	'mistral',
	'deepseek',
	'zenmux',
	'custom-openai',
] as const;

export type Provider = (typeof PROVIDERS)[number];

export const PROVIDERS_NAMES: Record<Provider, string> = {
	openai: 'OpenAI',
	anthropic: 'Anthropic',
	google: 'Google',
	mistral: 'Mistral',
	deepseek: 'DeepSeek',
	zenmux: 'Zenmux',
	'custom-openai': 'Custom OpenAI-Compatible',
};

export const PROVIDER_MODELS: Record<Provider, string[]> = {
	openai: ['gpt-4o-mini', 'gpt-4o'],
	anthropic: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
	google: ['gemini-2.5-flash', 'gemini-2.5-pro'],
	mistral: ['mistral-small-latest', 'mistral-large-latest'],
	deepseek: ['deepseek-chat', 'deepseek-reasoner'],
	zenmux: ['stepfun/step-3.5-flash', 'google/gemini-3-flash-preview'],
	'custom-openai': ['gpt-4o-mini'],
};

export const DEFAULT_PROVIDER: Provider = 'openai';

export const DEFAULT_MODELS: Record<Provider, string> = {
	openai: PROVIDER_MODELS.openai[0],
	anthropic: PROVIDER_MODELS.anthropic[0],
	google: PROVIDER_MODELS.google[0],
	mistral: PROVIDER_MODELS.mistral[0],
	deepseek: PROVIDER_MODELS.deepseek[0],
	zenmux: PROVIDER_MODELS.zenmux[0],
	'custom-openai': PROVIDER_MODELS['custom-openai'][0],
};

function trimOrUndefined(value?: string): string | undefined {
	const trimmed = value?.trim();
	return trimmed === '' ? undefined : trimmed;
}

export function resolveModel(settings: TextCompleteSettings) {
	const provider = settings.completions.provider;
	const modelId = settings.completions.model;

	// NOTE: Use dynamic requires here to avoid type mismatches across AI SDK versions.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const openaiModule = require('@ai-sdk/openai');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const anthropicModule = require('@ai-sdk/anthropic');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const googleModule = require('@ai-sdk/google');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const mistralModule = require('@ai-sdk/mistral');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const deepseekModule = require('@ai-sdk/deepseek');

	switch (provider) {
		case 'openai': {
			const apiKey = trimOrUndefined(settings.providers.openai.apiKey);
			const baseURL = trimOrUndefined(settings.providers.openai.baseUrl);
			if (openaiModule.createOpenAI) {
				const instance = openaiModule.createOpenAI({ apiKey, baseURL });
				return instance(modelId);
			}
			return openaiModule.openai(modelId);
		}
		case 'anthropic': {
			const apiKey = trimOrUndefined(settings.providers.anthropic.apiKey);
			const baseURL = trimOrUndefined(settings.providers.anthropic.baseUrl);
			if (anthropicModule.createAnthropic) {
				const instance = anthropicModule.createAnthropic({ apiKey, baseURL });
				return instance(modelId);
			}
			return anthropicModule.anthropic(modelId);
		}
		case 'google': {
			const apiKey = trimOrUndefined(settings.providers.google.apiKey);
			const baseURL = trimOrUndefined(settings.providers.google.baseUrl);
			if (googleModule.createGoogleGenerativeAI) {
				const instance = googleModule.createGoogleGenerativeAI({
					apiKey,
					baseURL,
				});
				return instance(modelId);
			}
			return googleModule.google(modelId);
		}
		case 'mistral': {
			const apiKey = trimOrUndefined(settings.providers.mistral.apiKey);
			const baseURL = trimOrUndefined(settings.providers.mistral.baseUrl);
			if (mistralModule.createMistral) {
				const instance = mistralModule.createMistral({ apiKey, baseURL });
				return instance(modelId);
			}
			return mistralModule.mistral(modelId);
		}
		case 'deepseek': {
			const apiKey = trimOrUndefined(settings.providers.deepseek.apiKey);
			const baseURL = trimOrUndefined(settings.providers.deepseek.baseUrl);
			if (deepseekModule.createDeepSeek) {
				const instance = deepseekModule.createDeepSeek({ apiKey, baseURL });
				return instance(modelId);
			}
			return deepseekModule.deepseek(modelId);
		}
		case 'zenmux': {
			const apiKey = trimOrUndefined(settings.providers.zenmux.apiKey);
			const baseURL =
				trimOrUndefined(settings.providers.zenmux.baseUrl) ??
				'https://zenmux.ai/api/v1';
			if (openaiModule.createOpenAI) {
				const instance = openaiModule.createOpenAI({ apiKey, baseURL });
				return instance.chat ? instance.chat(modelId) : instance(modelId);
			}
			return openaiModule.openai.chat
				? openaiModule.openai.chat(modelId)
				: openaiModule.openai(modelId);
		}
		case 'custom-openai': {
			const apiKey = trimOrUndefined(settings.providers.customOpenAI.apiKey);
			const baseURL = trimOrUndefined(settings.providers.customOpenAI.baseUrl);
			if (openaiModule.createOpenAI) {
				const instance = openaiModule.createOpenAI({ apiKey, baseURL });
				return instance(modelId);
			}
			return openaiModule.openai(modelId);
		}
	}
}
