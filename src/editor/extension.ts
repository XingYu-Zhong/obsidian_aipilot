import TextComplete from 'src/main';
import { InlineSuggestion, SuggestionTask } from 'src/api';
import {
	acceptCompletionsOnKeydown,
	rejectCompletionsOnKeydown,
} from './keymap';
import { showCompletionsOnUpdate } from './listener';
import { completionsStateField } from './state';
import { completionsRenderPlugin } from './view';

export type CompletionsFetcher = (
	prefix: string,
	suffix: string,
	task?: SuggestionTask,
) => Promise<InlineSuggestion | undefined>;

export type CompletionsCancel = () => void;
export type CompletionsForce = () => void;

export function inlineCompletionsExtension(
	fetcher: CompletionsFetcher,
	cancel: () => void,
	force: () => void,
	plugin: TextComplete,
) {
	return [
		completionsStateField,
		completionsRenderPlugin,
		showCompletionsOnUpdate(fetcher, plugin),
		acceptCompletionsOnKeydown(force, plugin),
		rejectCompletionsOnKeydown(cancel, plugin),
	];
}
