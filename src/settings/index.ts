import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import {
	DEFAULT_MODELS,
	DEFAULT_PROVIDER,
	Provider,
	PROVIDERS,
	PROVIDERS_NAMES,
} from 'src/api/provider';
import { DEFAULT_ROLE_PLAY } from 'src/api/prompts/role-play';
import { TextCompleteSettings } from 'src/types';
import TextComplete from '../main';

export const DEFAULT_SETTINGS: TextCompleteSettings = {
	version: '0.1.0',
	connectionValidation: {
		lastSuccessfulProvider: undefined,
		lastSuccessfulModel: undefined,
	},
	providers: {
		openai: {
			apiKey: undefined,
			baseUrl: undefined,
		},
		anthropic: {
			apiKey: undefined,
			baseUrl: undefined,
		},
		google: {
			apiKey: undefined,
			baseUrl: undefined,
		},
		mistral: {
			apiKey: undefined,
			baseUrl: undefined,
		},
		deepseek: {
			apiKey: undefined,
			baseUrl: undefined,
		},
		xai: {
			apiKey: undefined,
			baseUrl: undefined,
		},
		zenmux: {
			apiKey: undefined,
			baseUrl: 'https://zenmux.ai/api/v1',
		},
		customOpenAI: {
			apiKey: undefined,
			baseUrl: undefined,
		},
	},
	completions: {
		enabled: true,
		provider: DEFAULT_PROVIDER,
		model: DEFAULT_MODELS[DEFAULT_PROVIDER],
		maxTokens: 64,
		temperature: 0,
		waitTime: 500,
		windowSize: 512,
		replaceWindowSize: 24,
		acceptKey: 'Tab',
		rejectKey: 'Escape',
		ignoredFiles: [],
		ignoredTags: [],
	},
	cache: {
		enabled: true,
	},
	prompts: {
		rolePlay: DEFAULT_ROLE_PLAY,
	},
};

export function normalizeSettings(
	data: Partial<TextCompleteSettings> | null,
): TextCompleteSettings {
	if (data == null) {
	return {
			...DEFAULT_SETTINGS,
			connectionValidation: {
				...DEFAULT_SETTINGS.connectionValidation,
			},
			providers: {
				...DEFAULT_SETTINGS.providers,
				openai: { ...DEFAULT_SETTINGS.providers.openai },
				anthropic: { ...DEFAULT_SETTINGS.providers.anthropic },
				google: { ...DEFAULT_SETTINGS.providers.google },
				mistral: { ...DEFAULT_SETTINGS.providers.mistral },
				deepseek: { ...DEFAULT_SETTINGS.providers.deepseek },
				xai: { ...DEFAULT_SETTINGS.providers.xai },
				zenmux: { ...DEFAULT_SETTINGS.providers.zenmux },
				customOpenAI: { ...DEFAULT_SETTINGS.providers.customOpenAI },
			},
			completions: {
				...DEFAULT_SETTINGS.completions,
				ignoredFiles: [...DEFAULT_SETTINGS.completions.ignoredFiles],
				ignoredTags: [...DEFAULT_SETTINGS.completions.ignoredTags],
			},
			cache: {
				...DEFAULT_SETTINGS.cache,
			},
			prompts: {
				...DEFAULT_SETTINGS.prompts,
			},
		};
	}

	const provider = data.completions?.provider ?? DEFAULT_SETTINGS.completions.provider;
	const model = data.completions?.model ?? DEFAULT_MODELS[provider] ?? DEFAULT_SETTINGS.completions.model;

	return {
		version: data.version ?? DEFAULT_SETTINGS.version,
		connectionValidation: {
			lastSuccessfulProvider:
				data.connectionValidation?.lastSuccessfulProvider ??
				DEFAULT_SETTINGS.connectionValidation.lastSuccessfulProvider,
			lastSuccessfulModel:
				data.connectionValidation?.lastSuccessfulModel ??
				DEFAULT_SETTINGS.connectionValidation.lastSuccessfulModel,
		},
		providers: {
			openai: {
				apiKey: data.providers?.openai?.apiKey,
				baseUrl: data.providers?.openai?.baseUrl,
			},
			anthropic: {
				apiKey: data.providers?.anthropic?.apiKey,
				baseUrl: data.providers?.anthropic?.baseUrl,
			},
			google: {
				apiKey: data.providers?.google?.apiKey,
				baseUrl: data.providers?.google?.baseUrl,
			},
			mistral: {
				apiKey: data.providers?.mistral?.apiKey,
				baseUrl: data.providers?.mistral?.baseUrl,
			},
			deepseek: {
				apiKey: data.providers?.deepseek?.apiKey,
				baseUrl: data.providers?.deepseek?.baseUrl,
			},
			xai: {
				apiKey: data.providers?.xai?.apiKey,
				baseUrl: data.providers?.xai?.baseUrl,
			},
			zenmux: {
				apiKey: data.providers?.zenmux?.apiKey,
				baseUrl:
					data.providers?.zenmux?.baseUrl ??
					DEFAULT_SETTINGS.providers.zenmux.baseUrl,
			},
			customOpenAI: {
				apiKey: data.providers?.customOpenAI?.apiKey,
				baseUrl:
					data.providers?.customOpenAI?.baseUrl ?? 'http://127.0.0.1:11434/v1',
			},
		},
		completions: {
			enabled: data.completions?.enabled ?? DEFAULT_SETTINGS.completions.enabled,
			provider,
			model,
			maxTokens:
				data.completions?.maxTokens ?? DEFAULT_SETTINGS.completions.maxTokens,
			temperature:
				data.completions?.temperature ?? DEFAULT_SETTINGS.completions.temperature,
			waitTime:
				data.completions?.waitTime ?? DEFAULT_SETTINGS.completions.waitTime,
			windowSize:
				data.completions?.windowSize ?? DEFAULT_SETTINGS.completions.windowSize,
			replaceWindowSize:
				data.completions?.replaceWindowSize ??
				DEFAULT_SETTINGS.completions.replaceWindowSize,
			acceptKey:
				data.completions?.acceptKey ?? DEFAULT_SETTINGS.completions.acceptKey,
			rejectKey:
				data.completions?.rejectKey ?? DEFAULT_SETTINGS.completions.rejectKey,
			ignoredFiles:
				data.completions?.ignoredFiles ?? DEFAULT_SETTINGS.completions.ignoredFiles,
			ignoredTags:
				data.completions?.ignoredTags ?? DEFAULT_SETTINGS.completions.ignoredTags,
		},
		cache: {
			enabled: data.cache?.enabled ?? DEFAULT_SETTINGS.cache.enabled,
		},
		prompts: {
			rolePlay: data.prompts?.rolePlay ?? DEFAULT_SETTINGS.prompts.rolePlay,
		},
	};
}

function parseNumber(value: string, fallback: number) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function isBlank(value?: string): boolean {
	return !value || value.trim() === '';
}

const MODEL_PLACEHOLDERS: Record<Provider, string> = {
	openai: 'e.g. gpt-4o-mini',
	anthropic: 'e.g. claude-3-7-sonnet-latest',
	google: 'e.g. gemini-2.5-flash',
	mistral: 'e.g. mistral-small-latest',
	deepseek: 'e.g. deepseek-chat',
	xai: 'e.g. grok-4-1-fast-non-reasoning',
	zenmux: 'e.g. x-ai/grok-4.1-fast-non-reasoning',
	'custom-openai': 'e.g. llama3.1:8b-instruct-q4_K_M',
};

const API_KEY_PLACEHOLDERS: Record<Provider, string> = {
	openai: 'sk-...',
	anthropic: 'sk-ant-...',
	google: 'AIza...',
	mistral: '...',
	deepseek: '...',
	xai: 'xai-...',
	zenmux: '...',
	'custom-openai': '...',
};

const BASE_URL_PLACEHOLDERS: Partial<Record<Provider, string>> = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com/v1',
	google: 'https://generativelanguage.googleapis.com/v1beta',
	mistral: 'https://api.mistral.ai/v1',
	deepseek: 'https://api.deepseek.com/v1',
	xai: 'https://api.x.ai/v1',
	zenmux: 'https://zenmux.ai/api/v1',
	'custom-openai': 'http://127.0.0.1:11434/v1',
};

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
		case 'xai':
			return settings.providers.xai;
		case 'zenmux':
			return settings.providers.zenmux;
		case 'custom-openai':
			return settings.providers.customOpenAI;
	}
}

export class TextCompleteSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: TextComplete,
	) {
		super(app, plugin);
	}

	async display() {
		const { containerEl } = this;
		containerEl.empty();

		const { settings } = this.plugin;

		new Setting(containerEl).setName('Inline Completions').setHeading();

		new Setting(containerEl)
			.setName('Enable inline completions')
			.setDesc('Enable only after Test Connection passes for current provider/model.')
			.addToggle((toggle) =>
				toggle.setValue(settings.completions.enabled).onChange(async (value) => {
					if (value && !this.plugin.canEnableCompletions()) {
						toggle.setValue(false);
						new Notice(
							'Please pass Test Connection for the current provider/model before enabling inline completions.',
						);
						return;
					}
					settings.completions.enabled = value;
					await this.saveAndRefreshEditor();
				}),
			)
			.addButton((button) =>
				button.setButtonText('Test Connection').onClick(async () => {
					const provider = settings.completions.provider;
					const providerConfig = getProviderConfig(settings, provider);
					if (isBlank(settings.completions.model)) {
						new Notice('Connection failed: model id is empty.');
						return;
					}
					if (provider !== 'custom-openai' && isBlank(providerConfig.apiKey)) {
						new Notice('Connection failed: API key is empty.');
						return;
					}
					const client = this.plugin.createAPIClient();
					const result = await client.testConnection();
					const detailText = result.details ? `\n${result.details}` : '';
					if (result.ok) {
						settings.connectionValidation.lastSuccessfulProvider =
							settings.completions.provider;
						settings.connectionValidation.lastSuccessfulModel =
							settings.completions.model;
						await this.saveAndRefreshClient();
					}
					new Notice(
						result.ok
							? 'Connection successful.'
							: `Connection failed: ${result.error ?? 'Please check API key/model/provider.'}${detailText}`,
					);
				}),
			);

		new Setting(containerEl).setName('Completion AI Provider').setHeading();

		new Setting(containerEl)
			.setName('Provider')
			.setDesc('Choose one provider. Only that provider settings are shown.')
			.addDropdown((dropdown) => {
				for (const option of PROVIDERS) {
					dropdown.addOption(option, PROVIDERS_NAMES[option]);
				}
				dropdown.setValue(settings.completions.provider).onChange(async (value) => {
					settings.completions.provider = value as Provider;
					settings.completions.model = DEFAULT_MODELS[settings.completions.provider];
					settings.completions.enabled = false;
					await this.saveAndRefreshClient();
					this.display();
				});
			});

		const selectedProvider = settings.completions.provider;
		const selectedProviderConfig = getProviderConfig(settings, selectedProvider);
		const providerName = PROVIDERS_NAMES[selectedProvider];

		new Setting(containerEl)
			.setName(`${providerName} API key`)
			.setDesc('Only used for the selected provider.')
			.addText((text) =>
				text
					.setPlaceholder(API_KEY_PLACEHOLDERS[selectedProvider])
					.setValue(selectedProviderConfig.apiKey ?? '')
					.onChange(async (value) => {
						selectedProviderConfig.apiKey = value;
						await this.saveAndRefreshClient();
					}),
			);

		new Setting(containerEl)
			.setName(`${providerName} base URL`)
			.setDesc('Optional for most providers, required for OpenAI-compatible endpoints.')
			.addText((text) =>
				text
					.setPlaceholder(BASE_URL_PLACEHOLDERS[selectedProvider] ?? '')
					.setValue(selectedProviderConfig.baseUrl ?? '')
					.onChange(async (value) => {
						selectedProviderConfig.baseUrl = value;
						await this.saveAndRefreshClient();
					}),
			);

		new Setting(containerEl)
			.setName('Model ID')
			.setDesc('Free-form model id. Different providers use different formats.')
			.addText((text) =>
				text
					.setPlaceholder(MODEL_PLACEHOLDERS[selectedProvider])
					.setValue(settings.completions.model)
					.onChange(async (value) => {
						settings.completions.model = value.trim();
						await this.saveAndRefreshClient();
					}),
			);

		new Setting(containerEl)
			.setName('Role Play (system prompt)')
			.setDesc(
				'Define assistant role for completion behavior. Leave empty to use default.',
			)
			.addTextArea((text) => {
				text.inputEl.rows = 10;
				text.inputEl.style.width = '100%';
				text.inputEl.style.maxWidth = '120px';
				text.inputEl.style.minWidth = '50px';
				text.setValue(settings.prompts.rolePlay).onChange(async (value) => {
					settings.prompts.rolePlay = value;
					await this.saveAndRefreshClient();
				});
			})
			.addButton((button) =>
				button.setButtonText('Reset Default').onClick(async () => {
					settings.prompts.rolePlay = DEFAULT_ROLE_PLAY;
					await this.saveAndRefreshClient();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName('Max tokens')
			.addText((text) =>
				text
					.setValue(String(settings.completions.maxTokens))
					.onChange(async (value) => {
						settings.completions.maxTokens = parseNumber(
							value,
							DEFAULT_SETTINGS.completions.maxTokens,
						);
						await this.saveAndRefreshClient();
					}),
			);

		new Setting(containerEl)
			.setName('Temperature')
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.1)
					.setValue(settings.completions.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						settings.completions.temperature = value;
						await this.saveAndRefreshClient();
					}),
			);

		new Setting(containerEl)
			.setName('Wait time (seconds)')
			.setDesc('Delay in seconds before requesting completion after typing.')
			.addText((text) =>
				text
					.setValue(String(settings.completions.waitTime / 1000))
					.onChange(async (value) => {
						const waitSeconds = parseNumber(
							value,
							DEFAULT_SETTINGS.completions.waitTime / 1000,
						);
						settings.completions.waitTime = Math.max(
							0,
							Math.round(waitSeconds * 1000),
						);
						await this.saveAndRefreshEditor();
					}),
			);

		new Setting(containerEl)
			.setName('Window size')
			.setDesc('Total context window used to build prompt.')
			.addText((text) =>
				text
					.setValue(String(settings.completions.windowSize))
					.onChange(async (value) => {
						settings.completions.windowSize = parseNumber(
							value,
							DEFAULT_SETTINGS.completions.windowSize,
						);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Replace window size')
			.setDesc('Maximum number of chars after cursor that inline replace may overwrite.')
			.addText((text) =>
				text
					.setValue(String(settings.completions.replaceWindowSize))
					.onChange(async (value) => {
						settings.completions.replaceWindowSize = parseNumber(
							value,
							DEFAULT_SETTINGS.completions.replaceWindowSize,
						);
						await this.saveAndRefreshClient();
					}),
			);

		new Setting(containerEl)
			.setName('Accept key')
			.setDesc('Default: Tab')
			.addText((text) =>
				text
					.setValue(settings.completions.acceptKey)
					.onChange(async (value) => {
						settings.completions.acceptKey = value.trim() || 'Tab';
						await this.saveAndRefreshEditor();
					}),
			);

		new Setting(containerEl)
			.setName('Reject key')
			.setDesc('Default: Escape')
			.addText((text) =>
				text
					.setValue(settings.completions.rejectKey)
					.onChange(async (value) => {
						settings.completions.rejectKey = value.trim() || 'Escape';
						await this.saveAndRefreshEditor();
					}),
			);

		new Setting(containerEl)
			.setName('Ignored files (comma separated glob)')
			.addTextArea((text) =>
				text
					.setValue(settings.completions.ignoredFiles.join(', '))
					.onChange(async (value) => {
						settings.completions.ignoredFiles = value
							.split(',')
							.map((part) => part.trim());
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Ignored tags (comma separated regex)')
			.addTextArea((text) =>
				text
					.setValue(settings.completions.ignoredTags.join(', '))
					.onChange(async (value) => {
						settings.completions.ignoredTags = value
							.split(',')
							.map((part) => part.trim());
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Cache').setHeading();

		new Setting(containerEl)
			.setName('Enable cache')
			.addToggle((toggle) =>
				toggle.setValue(settings.cache.enabled).onChange(async (value) => {
					settings.cache.enabled = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	private async saveAndRefreshClient() {
		await this.plugin.saveSettings();
		this.plugin.updateAPIClient();
	}

	private async saveAndRefreshEditor() {
		await this.plugin.saveSettings();
		this.plugin.updateAPIClient();
		this.plugin.updateEditorExtension();
	}
}
