import { Provider } from './api/provider';

export interface TextCompleteSettings {
	version: string;
	connectionValidation: {
		lastSuccessfulProvider?: Provider;
		lastSuccessfulModel?: string;
	};
	providers: {
		openai: {
			apiKey?: string;
			baseUrl?: string;
		};
		anthropic: {
			apiKey?: string;
			baseUrl?: string;
		};
		google: {
			apiKey?: string;
			baseUrl?: string;
		};
		mistral: {
			apiKey?: string;
			baseUrl?: string;
		};
		deepseek: {
			apiKey?: string;
			baseUrl?: string;
		};
		xai: {
			apiKey?: string;
			baseUrl?: string;
		};
		zenmux: {
			apiKey?: string;
			baseUrl?: string;
		};
		customOpenAI: {
			apiKey?: string;
			baseUrl?: string;
		};
	};
	completions: {
		enabled: boolean;
		provider: Provider;
		model: string;
		maxTokens: number;
		temperature: number;
		waitTime: number;
		windowSize: number;
		replaceWindowSize: number;
		acceptKey: string;
		rejectKey: string;
		ignoredFiles: string[];
		ignoredTags: string[];
	};
	cache: {
		enabled: boolean;
	};
	prompts: {
		rolePlay: string;
	};
}
