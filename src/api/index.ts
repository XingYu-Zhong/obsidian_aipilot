export interface ConnectionResult {
	ok: boolean;
	error?: string;
	details?: string;
}

export interface APIClient {
	fetchCompletions(prefix: string, suffix: string): Promise<string | undefined>;
	testConnection(): Promise<ConnectionResult>;
}
