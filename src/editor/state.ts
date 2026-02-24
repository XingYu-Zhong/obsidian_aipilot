import { StateEffect, StateField } from '@codemirror/state';

export const setCompletionsEffect = StateEffect.define<{
	completions: string;
	replaceLength: number;
}>();

export const unsetCompletionsEffect = StateEffect.define();

interface CompletionsState {
	completions: string;
	replaceLength: number;
}

export const completionsStateField = StateField.define<
	CompletionsState | undefined
>({
	create(state) {
		return undefined;
	},
	update(value, transaction) {
		for (const effect of transaction.effects) {
			if (effect.is(setCompletionsEffect)) {
				return {
					completions: effect.value.completions,
					replaceLength: effect.value.replaceLength,
				};
			} else if (effect.is(unsetCompletionsEffect)) {
				return undefined;
			}
		}

		return value;
	},
});
