import { minimatch } from 'minimatch';
import { MarkdownView } from 'obsidian';
import TextComplete from 'src/main';
import { APIClient, SuggestionTask } from '..';

export class IgnoredFilter implements APIClient {
	constructor(
		private readonly client: APIClient,
		private readonly plugin: TextComplete,
	) {}

	async fetchCompletions(
		prefix: string,
		suffix: string,
		task?: SuggestionTask,
	) {
		const { settings } = this.plugin;

		const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;
		const content = view?.editor.getValue();

		const isIgnoredFile = settings.completions.ignoredFiles.some(
			(filePattern) =>
				file?.path &&
				filePattern.trim() !== '' &&
				minimatch(file.path, filePattern),
		);
		const hasIgnoredTags = settings.completions.ignoredTags.some(
			(tagRegex) =>
				content && tagRegex.trim() !== '' && new RegExp(tagRegex, 'gm').test(content),
		);
		if (isIgnoredFile || hasIgnoredTags) {
			return undefined;
		}

		return this.client.fetchCompletions(prefix, suffix, task);
	}

	testConnection() {
		return this.client.testConnection();
	}
}
