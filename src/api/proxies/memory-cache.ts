import { createHash } from 'crypto';
import TextComplete from 'src/main';
import { APIClient } from '..';

export class MemoryCacheProxy implements APIClient {
	private store: Map<string, string> = new Map();

	constructor(
		private readonly client: APIClient,
		private readonly plugin: TextComplete,
	) {}

	async fetchCompletions(prefix: string, suffix: string) {
		const { settings } = this.plugin;

		if (!settings.cache.enabled) {
			return this.client.fetchCompletions(prefix, suffix);
		}

		const windowSize = settings.completions.windowSize / 2;
		const truncatedPrefix = prefix.slice(
			Math.max(0, prefix.length - windowSize / 2),
			prefix.length,
		);
		const truncatedSuffix = suffix.slice(0, windowSize / 2);

		const compactPrefix = truncatedPrefix.replace(/\s\s+/g, ' ');
		const compactSuffix = truncatedSuffix.replace(/\s\s+/g, ' ');

		const hash = createHash('sha256')
			.update(`${compactPrefix} ${compactSuffix} `, 'utf8')
			.digest('hex');

		if (this.store.has(hash)) {
			return this.store.get(hash);
		}

		const completions = await this.client.fetchCompletions(prefix, suffix);
		if (completions === undefined) {
			return undefined;
		}
		this.store.set(hash, completions);
		return completions;
	}

	testConnection() {
		return this.client.testConnection();
	}
}
