import {
	Decoration,
	DecorationSet,
	EditorView,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view';
import { completionsStateField } from './state';

class CompletionsWidget extends WidgetType {
	constructor(private readonly completions: string) {
		super();
	}

	toDOM(view: EditorView) {
		const spanEl = document.createElement('span');
		spanEl.classList.add('textcomplete-completions');
		spanEl.textContent = this.completions;
		return spanEl;
	}

	get lineBreaks() {
		return this.completions.split('\n').length - 1;
	}
}

class CompletionsRenderPluginValue implements PluginValue {
	public decorations: DecorationSet = Decoration.none;

	update(update: ViewUpdate) {
		const { state } = update;

		const completionsState = state.field(completionsStateField);
		if (completionsState === undefined) {
			this.decorations = Decoration.none;
			return;
		}

		const widget = Decoration.widget({
			widget: new CompletionsWidget(completionsState.completions),
			side: 1,
		});
		const ranges = [widget.range(state.selection.main.head)];
		if (completionsState.replaceLength > 0) {
			const from = state.selection.main.head;
			const to = Math.min(from + completionsState.replaceLength, state.doc.length);
			const strike = Decoration.mark({ class: 'textcomplete-replace-target' });
			ranges.push(strike.range(from, to));
		}
		this.decorations = Decoration.set(ranges, true);
	}
}

const completionsRenderPluginSpec: PluginSpec<CompletionsRenderPluginValue> = {
	decorations: (value: CompletionsRenderPluginValue) => value.decorations,
};

export const completionsRenderPlugin = ViewPlugin.fromClass(
	CompletionsRenderPluginValue,
	completionsRenderPluginSpec,
);
