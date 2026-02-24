import { EditorView, ViewUpdate } from '@codemirror/view';
import { SuggestionTask } from 'src/api';
import { Notice } from 'obsidian';
import TextComplete from 'src/main';
import { CompletionsFetcher } from './extension';
import { setCompletionsEffect, unsetCompletionsEffect } from './state';

interface RecentEdit {
	timestamp: number;
	deleted: string;
	inserted: string;
}

const RECENT_EDIT_WINDOW_MS = 2000;
const MAX_RECENT_EDITS = 8;
const MAX_EDIT_TEXT_CHARS = 160;

function truncateEditText(text: string): string {
	const normalized = text.replace(/\r/g, '');
	if (normalized.length <= MAX_EDIT_TEXT_CHARS) {
		return normalized;
	}
	return `${normalized.slice(0, MAX_EDIT_TEXT_CHARS)}...`;
}

function collectTransactionEdits(update: ViewUpdate, now: number): RecentEdit[] {
	if (!update.docChanged) {
		return [];
	}

	const edits: RecentEdit[] = [];
	update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
		const deleted = update.startState.sliceDoc(fromA, toA);
		const insertedText = inserted.toString();
		if (deleted === insertedText) {
			return;
		}
		if (deleted.length === 0 && insertedText.length === 0) {
			return;
		}
		edits.push({
			timestamp: now,
			deleted,
			inserted: insertedText,
		});
	});
	return edits;
}

function formatRecentEdits(edits: RecentEdit[], now: number): string {
	const lines = edits
		.slice(-MAX_RECENT_EDITS)
		.map((edit) => {
			const ago = Math.max(0, now - edit.timestamp);
			const deleted = JSON.stringify(truncateEditText(edit.deleted));
			const inserted = JSON.stringify(truncateEditText(edit.inserted));
			return `t-${ago}ms: deleted=${deleted} inserted=${inserted}`;
		});

	return lines.join('\n');
}

function compactRecentEdits(edits: RecentEdit[], now: number): RecentEdit[] {
	return edits
		.filter((edit) => now - edit.timestamp <= RECENT_EDIT_WINDOW_MS)
		.slice(-MAX_RECENT_EDITS);
}

function showCompletions(fetcher: CompletionsFetcher) {
	let lastHead = -1;
	let latestCompletionsId = 0;
	let recentEdits: RecentEdit[] = [];

	return async (update: ViewUpdate) => {
		const { state, view } = update;
		const now = Date.now();
		recentEdits = compactRecentEdits(
			recentEdits.concat(collectTransactionEdits(update, now)),
			now,
		);

		const previousHead = lastHead;
		const currentHead = state.selection.main.head;
		lastHead = currentHead;
		if (!update.docChanged && currentHead === previousHead) {
			return;
		}

		view.dispatch({
			effects: [unsetCompletionsEffect.of(null)],
		});

		if (state.selection.ranges.length > 1 || !state.selection.main.empty) {
			return;
		}

		const head = state.selection.main.head;
		const char = state.sliceDoc(head, head + 1);
		if (char.length === 1 && !char.match(/^[\p{P}\s]/u)) {
			return;
		}

		const prefix = state.sliceDoc(0, head);
		const suffix = state.sliceDoc(head, state.doc.length);
		if (prefix.trim() === '') {
			return;
		}

		const currentCompletionsId = ++latestCompletionsId;
		const task: SuggestionTask | undefined =
			recentEdits.length > 0
				? {
						recentEdits: formatRecentEdits(recentEdits, now),
					}
				: undefined;

		const suggestion = await fetcher(prefix, suffix, task).catch((error) => {
			console.error(error);
			new Notice('Failed to fetch completions.');
			return undefined;
		});
		if (suggestion === undefined) {
			return;
		}

		if (currentCompletionsId !== latestCompletionsId) {
			return;
		}

		view.dispatch({
			effects: [
				setCompletionsEffect.of({
					completions: suggestion.text,
					replaceLength: suggestion.replaceLength,
				}),
			],
		});
	};
}

export const showCompletionsOnUpdate = (
	fetcher: CompletionsFetcher,
	plugin: TextComplete,
) => EditorView.updateListener.of(showCompletions(fetcher));
