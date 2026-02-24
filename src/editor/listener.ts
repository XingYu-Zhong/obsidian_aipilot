import { EditorView, ViewUpdate } from '@codemirror/view';
import { Notice } from 'obsidian';
import TextComplete from 'src/main';
import { CompletionsFetcher } from './extension';
import { setCompletionsEffect, unsetCompletionsEffect } from './state';

function showCompletions(fetcher: CompletionsFetcher) {
	let lastHead = -1;
	let latestCompletionsId = 0;

	return async (update: ViewUpdate) => {
		const { state, view } = update;

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

		const completions = await fetcher(prefix, suffix).catch((error) => {
			console.error(error);
			new Notice('Failed to fetch completions.');
			return undefined;
		});
		if (completions === undefined) {
			return;
		}

		if (currentCompletionsId !== latestCompletionsId) {
			return;
		}

		view.dispatch({
			effects: [setCompletionsEffect.of({ completions })],
		});
	};
}

export const showCompletionsOnUpdate = (
	fetcher: CompletionsFetcher,
	plugin: TextComplete,
) => EditorView.updateListener.of(showCompletions(fetcher));
