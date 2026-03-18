import type { Lint, Span, Suggestion } from 'wasm';
import { SuggestionKind } from 'wasm';
import Linter from './Linter';
import LocalLinter from './LocalLinter';
import WorkerLinter from './WorkerLinter';

export { LocalLinter, WorkerLinter, SuggestionKind };
export type { Linter, Lint, Span, Suggestion };

/** A linting rule configuration dependent on upstream Harper's available rules.
 * This is a record, since you shouldn't hard-code the existence of any particular rules and should generalize based on this struct. */
export type LintConfig = Record<string, boolean | undefined>;

/** The option used to configure the parser for an individual linting operation. */
export type LintOptions = {
	/** The markup language that is being passed. Defaults to `markdown`. */
	language?: 'plaintext' | 'markdown';
};
