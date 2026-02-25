import { parseSuggestionPayload } from './suggestion-payload';

describe('parseSuggestionPayload', () => {
	const parsePlainText = (content: string) => `PLAIN:${content.trim()}`;

	test('parses direct JSON payload', () => {
		const suggestion = parseSuggestionPayload(
			'{"replace":3,"text":"hello"}',
			24,
			parsePlainText,
		);
		expect(suggestion).toEqual({
			text: 'hello',
			replaceLength: 3,
		});
	});

	test('parses JSON payload embedded after code with braces', () => {
		const raw = [
			"import { openai } from '@ai-sdk/openai';",
			'{"replace":24,"text":"generateText"}',
		].join('\n');
		const suggestion = parseSuggestionPayload(raw, 24, parsePlainText);
		expect(suggestion).toEqual({
			text: 'generateText',
			replaceLength: 24,
		});
	});

	test('parses fenced JSON payload', () => {
		const raw = ['```json', '{"replace":2,"text":"ok"}', '```'].join('\n');
		const suggestion = parseSuggestionPayload(raw, 24, parsePlainText);
		expect(suggestion).toEqual({
			text: 'ok',
			replaceLength: 2,
		});
	});

	test('recovers malformed JSON payload with raw newline in quoted text', () => {
		const raw = '{"replace":2,"text":"line1\nline2"}';
		const suggestion = parseSuggestionPayload(raw, 24, parsePlainText);
		expect(suggestion).toEqual({
			text: 'line1\nline2',
			replaceLength: 2,
		});
	});

	test('caps replace length to maxReplaceChars', () => {
		const suggestion = parseSuggestionPayload(
			'{"replace":999,"text":"hello"}',
			7,
			parsePlainText,
		);
		expect(suggestion).toEqual({
			text: 'hello',
			replaceLength: 7,
		});
	});

	test('falls back to plain text parser when payload is absent', () => {
		const suggestion = parseSuggestionPayload(
			'const value = { foo: 1 };',
			24,
			parsePlainText,
		);
		expect(suggestion).toEqual({
			text: 'PLAIN:const value = { foo: 1 };',
			replaceLength: 0,
		});
	});
});
