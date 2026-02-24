export interface ConnectionResult {
	ok: boolean;
	error?: string;
	details?: string;
}

export interface InlineSuggestion {
	text: string;
	replaceLength: number;
}

export interface SuggestionTask {
	instruction?: string;
	maxReplaceChars?: number;
	recentEdits?: string;
}

export interface APIClient {
	fetchCompletions(
		prefix: string,
		suffix: string,
		task?: SuggestionTask,
	): Promise<InlineSuggestion | undefined>;
	testConnection(): Promise<ConnectionResult>;
}
