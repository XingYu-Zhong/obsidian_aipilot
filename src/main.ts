import { Extension } from '@codemirror/state';
import { Notice, Plugin } from 'obsidian';
import { APIClient, SuggestionTask } from './api';
import { AISDKClient } from './api/client';
import { PromptGenerator } from './api/prompts/generator';
import { IgnoredFilter } from './api/proxies/ignored-filter';
import { MemoryCacheProxy } from './api/proxies/memory-cache';
import { inlineCompletionsExtension } from './editor/extension';
import { replaceSelectedTermInCurrentParagraph } from './editor/text-edit';
import {
	DEFAULT_SETTINGS,
	normalizeSettings,
	TextCompleteSettingTab,
} from './settings';
import { TextCompleteSettings } from './types';
import { debounceAsyncFunc } from './utils';

export default class TextComplete extends Plugin {
	settings: TextCompleteSettings = DEFAULT_SETTINGS;
	extensions: Extension[] = [];
	completionsClient: APIClient;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new TextCompleteSettingTab(this.app, this));

		this.completionsClient = this.createAPIClient();
		this.extensions = this.createEditorExtension();
		this.registerEditorExtension(this.extensions);

		this.registerRibbonActions();
		this.registerCommands();
	}

	registerRibbonActions() {
		this.addRibbonIcon(
			'bot',
			'Toggle inline completions',
			async () => {
				if (!this.settings.completions.enabled && !this.canEnableCompletions()) {
					new Notice(
						'Please pass Test Connection for the current provider/model before enabling inline completions.',
					);
					return;
				}
				this.settings.completions.enabled = !this.settings.completions.enabled;
				await this.saveSettings();
				new Notice(
					`Inline completions ${this.settings.completions.enabled ? 'enabled' : 'disabled'}.`,
				);
			},
		);
	}

	registerCommands() {
		this.addCommand({
			id: 'enable-completions',
			name: 'Enable inline completions',
			callback: async () => {
				if (!this.canEnableCompletions()) {
					new Notice(
						'Please pass Test Connection for the current provider/model before enabling inline completions.',
					);
					return;
				}
				this.settings.completions.enabled = true;
				await this.saveSettings();
				new Notice('Inline completions enabled.');
			},
		});

		this.addCommand({
			id: 'disable-completions',
			name: 'Disable inline completions',
			callback: async () => {
				this.settings.completions.enabled = false;
				await this.saveSettings();
				new Notice('Inline completions disabled.');
			},
		});

		this.addCommand({
			id: 'toggle-completions',
			name: 'Toggle inline completions',
			callback: async () => {
				if (!this.settings.completions.enabled && !this.canEnableCompletions()) {
					new Notice(
						'Please pass Test Connection for the current provider/model before enabling inline completions.',
					);
					return;
				}
				this.settings.completions.enabled = !this.settings.completions.enabled;
				await this.saveSettings();
				new Notice(
					`Inline completions ${this.settings.completions.enabled ? 'enabled' : 'disabled'}.`,
				);
			},
		});

		this.addCommand({
			id: 'replace-selected-term-in-current-paragraph',
			name: 'Text edit: edit selected text (LLM)',
			editorCallback: (editor) => {
				replaceSelectedTermInCurrentParagraph(
					this.app,
					editor,
					this.completionsClient,
				);
			},
		});

		this.addCommand({
			id: 'enable-cache',
			name: 'Enable cache',
			callback: async () => {
				this.settings.cache.enabled = true;
				await this.saveSettings();
				new Notice('Cache enabled.');
			},
		});

		this.addCommand({
			id: 'disable-cache',
			name: 'Disable cache',
			callback: async () => {
				this.settings.cache.enabled = false;
				await this.saveSettings();
				new Notice('Cache disabled.');
			},
		});

		this.addCommand({
			id: 'toggle-cache',
			name: 'Toggle cache',
			callback: async () => {
				this.settings.cache.enabled = !this.settings.cache.enabled;
				await this.saveSettings();
				new Notice(`Cache ${this.settings.cache.enabled ? 'enabled' : 'disabled'}.`);
			},
		});
	}

	createAPIClient() {
		const generator = new PromptGenerator(this);
		const client = new AISDKClient(generator, this);
		const clientWithFilter = new IgnoredFilter(client, this);
		const clientWithCache = new MemoryCacheProxy(clientWithFilter, this);
		return clientWithCache;
	}

	updateAPIClient() {
		this.completionsClient = this.createAPIClient();
	}

	createEditorExtension() {
		const fetcher = async (
			prefix: string,
			suffix: string,
			task?: SuggestionTask,
		) => {
			if (!this.settings.completions.enabled) {
				return undefined;
			}
			return this.completionsClient.fetchCompletions(prefix, suffix, task);
		};
		const { debounced, cancel, force } = debounceAsyncFunc(
			fetcher,
			this.settings.completions.waitTime,
		);

		return inlineCompletionsExtension(debounced, cancel, force, this);
	}

	updateEditorExtension() {
		this.extensions.splice(
			0,
			this.extensions.length,
			...this.createEditorExtension(),
		);
		this.app.workspace.updateOptions();
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<TextCompleteSettings> | null;
		this.settings = normalizeSettings(data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	canEnableCompletions(): boolean {
		return (
			this.settings.connectionValidation.lastSuccessfulProvider ===
				this.settings.completions.provider &&
			this.settings.connectionValidation.lastSuccessfulModel ===
				this.settings.completions.model
		);
	}
}
