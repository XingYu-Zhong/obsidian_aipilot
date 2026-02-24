import { APIClient } from 'src/api';
import { App, Editor, EditorPosition, Modal, Notice } from 'obsidian';

function getDocumentEnd(editor: Editor): EditorPosition {
	const lastLine = Math.max(0, editor.lineCount() - 1);
	return { line: lastLine, ch: editor.getLine(lastLine).length };
}

class EditInstructionModal extends Modal {
	private instruction = '';

	constructor(
		app: App,
		private readonly onConfirm: (instruction: string) => void,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h3', {
			text: 'Edit selected text',
		});

		const input = contentEl.createEl('textarea', {
			placeholder: 'e.g. Polish tone, keep meaning, keep Markdown format.',
		});
		input.style.width = '100%';
		input.style.minHeight = '96px';
		input.addEventListener('input', () => {
			this.instruction = input.value;
		});
		input.addEventListener('keydown', (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
				event.preventDefault();
				this.submit();
			}
		});

		const actions = contentEl.createDiv({ cls: 'textcomplete-modal-actions' });
		actions.style.display = 'flex';
		actions.style.gap = '8px';
		actions.style.marginTop = '12px';

		const submitButton = actions.createEl('button', { text: 'Apply' });
		submitButton.addEventListener('click', () => this.submit());

		const cancelButton = actions.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		input.focus();
	}

	private submit() {
		this.onConfirm(this.instruction.trim());
		this.close();
	}
}

export function replaceSelectedTermInCurrentParagraph(
	app: App,
	editor: Editor,
	client: APIClient,
) {
	const selected = editor.getSelection();
	if (selected.trim() === '') {
		new Notice('Select text first, then run this command.');
		return;
	}

	const from = editor.getCursor('from');
	const to = editor.getCursor('to');
	const prefix = editor.getRange({ line: 0, ch: 0 }, from);
	const selectedText = editor.getRange(from, to);
	const suffixAfterSelection = editor.getRange(to, getDocumentEnd(editor));

	new EditInstructionModal(app, (instruction) => {
		if (instruction === '') {
			new Notice('Edit instruction cannot be empty.');
			return;
		}

		void (async () => {
				const suggestion = await client.fetchCompletions(
					prefix,
					`${selectedText}${suffixAfterSelection}`,
					{
						instruction,
						maxReplaceChars: selectedText.length,
					},
				);
			if (suggestion === undefined) {
				new Notice('No edit suggestion returned.');
				return;
			}

			editor.replaceRange(suggestion.text, from, to);
			new Notice('Applied AI text edit to selection.');
		})();
	}).open();
}
