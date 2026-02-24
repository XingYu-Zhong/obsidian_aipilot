import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import TextComplete from 'src/main';
import { CompletionsCancel, CompletionsForce } from './extension';
import { completionsStateField, unsetCompletionsEffect } from './state';

export function acceptCompletionsOnKeydown(
	force: CompletionsForce,
	plugin: TextComplete,
) {
	let lastCompletionsTime = 0;

	function run(view: EditorView) {
		const { state } = view;

		if (state.selection.ranges.length > 1 || !state.selection.main.empty) {
			return false;
		}

		const completionsState = state.field(completionsStateField);
		if (completionsState === undefined) {
			return false;
		}

		view.dispatch({
			effects: [unsetCompletionsEffect.of(null)],
		});

		const head = state.selection.main.head;
		const replaceLength = completionsState.replaceLength;
		const newHead = head + completionsState.completions.length;

		view.dispatch({
			selection: {
				head: newHead,
				anchor: newHead,
			},
			changes: [
				state.changes({
					from: head,
					to: head + replaceLength,
					insert: completionsState.completions,
				}),
			],
		});

		const previousCompletionsTime = lastCompletionsTime;
		const currentCompletionsTime = Date.now();
		lastCompletionsTime = currentCompletionsTime;
		if (currentCompletionsTime - previousCompletionsTime < 500) {
			force();
			return true;
		}

		return true;
	}

	const key = plugin.settings.completions.acceptKey;
	return Prec.highest(keymap.of([{ key, run }]));
}

export function rejectCompletionsOnKeydown(
	cancel: CompletionsCancel,
	plugin: TextComplete,
) {
	function run(view: EditorView) {
		const { state } = view;

		if (state.selection.ranges.length > 1 || !state.selection.main.empty) {
			return false;
		}

		const completionsState = state.field(completionsStateField);
		if (completionsState === undefined) {
			return false;
		}

		cancel();
		view.dispatch({
			effects: [unsetCompletionsEffect.of(null)],
		});
		return true;
	}

	const key = plugin.settings.completions.rejectKey;
	return Prec.highest(keymap.of([{ key, run }]));
}
