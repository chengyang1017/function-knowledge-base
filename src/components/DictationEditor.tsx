import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Editor, {
  type BeforeMount,
  type OnMount,
} from '@monaco-editor/react';

import './DictationEditor.css';

type DictationEditorProps = {
  answer: string;
  language: string;
};

type EditorTheme = 'light' | 'dark';
type CheckState =
  | 'idle'
  | 'progress'
  | 'wrong'
  | 'complete';
type HintKind =
  | 'token'
  | 'skeleton'
  | 'reveal'
  | null;

const STRUCTURE_KEYWORDS = new Set([
  'abstract',
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'final',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'is',
  'let',
  'new',
  'null',
  'of',
  'override',
  'private',
  'protected',
  'public',
  'required',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const AUTO_CLOSING_CHARS = new Set([
  ')',
  ']',
  '}',
  '"',
  "'",
  '`',
]);

function compactCode(value: string): string {
  let compact = '';
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (const char of value) {
    if (quote !== null) {
      compact += char;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      compact += char;
      continue;
    }

    if (!/\s/.test(char)) {
      compact += char;
    }
  }

  return compact;
}

function containsOnlyAutoClosers(value: string): boolean {
  const compact = compactCode(value);

  return (
    compact.length > 0 &&
    [...compact].every((char) =>
      AUTO_CLOSING_CHARS.has(char),
    )
  );
}

function checkDraft(
  draft: string,
  answer: string,
  cursorOffset: number,
): CheckState {
  const target = compactCode(answer);
  const current = compactCode(draft);

  if (current.length === 0) {
    return 'idle';
  }

  if (current === target) {
    return 'complete';
  }

  if (target.startsWith(current)) {
    return 'progress';
  }

  const safeCursorOffset = Math.max(
    0,
    Math.min(cursorOffset, draft.length),
  );
  const beforeCursor = compactCode(
    draft.slice(0, safeCursorOffset),
  );
  const afterCursor = compactCode(
    draft.slice(safeCursorOffset),
  );

  if (!target.startsWith(beforeCursor)) {
    return 'wrong';
  }

  // Monaco inserts closing pairs before the user has filled their contents.
  // For example, typing `getVideos(` immediately creates `getVideos()` and
  // typing `{` creates `{}`. Those generated closers can also be nested, so a
  // draft may temporarily look like `getVideos()}` even though the answer has
  // many lines between `)` and the final `}`. As long as everything already
  // typed before the cursor is still an exact answer prefix, treat a suffix
  // made only of auto-closing characters as unfinished structure, not an error.
  if (
    afterCursor.length === 0 ||
    containsOnlyAutoClosers(afterCursor)
  ) {
    return 'progress';
  }

  // When editing in the middle of already-written code, preserve the earlier
  // hole-based behaviour: the prefix before the cursor and the suffix after
  // it may surround content that has not been typed yet.
  if (
    target.endsWith(afterCursor) &&
    beforeCursor.length + afterCursor.length <=
      target.length
  ) {
    return 'progress';
  }

  return 'wrong';
}

function answerIndexAtCursor(
  draft: string,
  answer: string,
  cursorOffset: number,
): number {
  const target = compactCode(answer);
  const beforeCursor = compactCode(
    draft.slice(
      0,
      Math.max(0, Math.min(cursorOffset, draft.length)),
    ),
  );

  let index = 0;

  while (
    index < beforeCursor.length &&
    index < target.length &&
    beforeCursor[index] === target[index]
  ) {
    index += 1;
  }

  return Math.min(index, target.length);
}

function nextExpectedToken(
  answer: string,
  answerIndex: number,
): string {
  const remaining = compactCode(answer).slice(answerIndex);

  if (!remaining) {
    return '答案末尾';
  }

  const token = remaining.match(
    /^(?:[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|=>|==|!=|<=|>=|\+\+|--|&&|\|\||\?\?|\.\.|[^A-Za-z0-9_$])/, 
  );

  return token?.[0] ?? remaining[0];
}

function answerLineAtIndex(
  answer: string,
  answerIndex: number,
): string {
  const lines = answer.split('\n');
  let compactOffset = 0;
  let fallback = lines.at(-1) ?? '';

  for (const line of lines) {
    const lineLength = compactCode(line).length;

    if (lineLength > 0) {
      fallback = line;
    }

    if (
      answerIndex < compactOffset + lineLength ||
      (answerIndex === 0 && compactOffset === 0)
    ) {
      return line;
    }

    compactOffset += lineLength;
  }

  return fallback;
}

function maskLineStructure(line: string): string {
  const withoutStrings = line.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g,
    '…',
  );

  return withoutStrings
    .replace(/\b\d+(?:\.\d+)?\b/g, '#')
    .replace(
      /\b[A-Za-z_$][\w$]*\b/g,
      (word) =>
        STRUCTURE_KEYWORDS.has(word)
          ? word
          : '___',
    );
}

function DictationEditor({
  answer,
  language,
}: DictationEditorProps) {
  const [draft, setDraft] = useState('');
  const [cursorOffset, setCursorOffset] =
    useState(0);
  const [editorTheme, setEditorTheme] =
    useState<EditorTheme>(() =>
      document.documentElement.dataset.theme === 'dark'
        ? 'dark'
        : 'light',
    );
  const [hintStep, setHintStep] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [hintKind, setHintKind] =
    useState<HintKind>(null);
  const [hintMessage, setHintMessage] = useState('');

  const editorRef =
    useRef<Parameters<OnMount>[0] | null>(null);
  const hintTimerRef =
    useRef<number | null>(null);

  useEffect(() => {
    setDraft('');
    setCursorOffset(0);
    setHintStep(0);
    setHintCount(0);
    setHintKind(null);
    setHintMessage('');

    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, [answer]);

  useEffect(() => {
    const syncTheme = () => {
      setEditorTheme(
        document.documentElement.dataset.theme === 'dark'
          ? 'dark'
          : 'light',
      );
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
      }
    },
    [],
  );

  const checkState = useMemo(
    () =>
      checkDraft(
        draft,
        answer,
        cursorOffset,
      ),
    [draft, answer, cursorOffset],
  );

  const editorHeight = `${Math.min(
    640,
    Math.max(
      320,
      answer.split('\n').length * 24 + 72,
    ),
  )}px`;

  const handleBeforeMount: BeforeMount = (
    monaco,
  ) => {
    monaco.editor.defineTheme('site-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
        'editor.lineHighlightBackground': '#ffffff08',
        'editorLineNumber.foreground': '#8b98a9',
        'editorLineNumber.activeForeground': '#dbe7f5',
      },
    });

    monaco.editor.defineTheme('site-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
        'editor.lineHighlightBackground': '#00000008',
        'editorLineNumber.foreground': '#8a919d',
        'editorLineNumber.activeForeground': '#374151',
      },
    });
  };

  const handleMount: OnMount = (
    editor,
  ) => {
    editorRef.current = editor;

    const syncCursor = () => {
      const position = editor.getPosition();
      const model = editor.getModel();

      if (!position || !model) {
        return;
      }

      setCursorOffset(
        model.getOffsetAt(position),
      );
    };

    syncCursor();
    editor.onDidChangeCursorPosition(syncCursor);
    editor.focus();
  };

  function clearVisibleHint() {
    setHintKind(null);
    setHintMessage('');

    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }

  function handleChange(value: string | undefined) {
    const nextValue = value ?? '';
    setDraft(nextValue);
    clearVisibleHint();

    const editor = editorRef.current;
    const position = editor?.getPosition();
    const model = editor?.getModel();

    if (position && model) {
      setCursorOffset(
        model.getOffsetAt(position),
      );
    }
  }

  function requestHint() {
    const nextStep = hintStep >= 3
      ? 1
      : hintStep + 1;
    const answerIndex = answerIndexAtCursor(
      draft,
      answer,
      cursorOffset,
    );
    const answerLine = answerLineAtIndex(
      answer,
      answerIndex,
    );

    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }

    setHintStep(nextStep);
    setHintCount((current) => current + 1);

    if (nextStep === 1) {
      setHintKind('token');
      setHintMessage(
        nextExpectedToken(answer, answerIndex),
      );
      return;
    }

    if (nextStep === 2) {
      setHintKind('skeleton');
      setHintMessage(
        maskLineStructure(answerLine).trim(),
      );
      return;
    }

    setHintKind('reveal');
    setHintMessage(answerLine.trimEnd());
    hintTimerRef.current = window.setTimeout(() => {
      setHintKind(null);
      setHintMessage('');
      hintTimerRef.current = null;
    }, 3000);
  }

  return (
    <div className="dictation-workspace">
      <div className="dictation-toolbar">
        <div className="dictation-toolbar-copy">
          <strong>默写中</strong>
          {hintCount > 0 && (
            <span>已用 {hintCount} 次提示</span>
          )}
        </div>

        <button
          type="button"
          className="dictation-hint-button"
          onClick={requestHint}
        >
          提示
        </button>
      </div>

      {hintKind && hintMessage && (
        <div
          className={`dictation-hint-panel ${hintKind}`}
          role="status"
        >
          <span className="dictation-hint-label">
            {hintKind === 'token'
              ? '下一处'
              : hintKind === 'skeleton'
                ? '当前行骨架'
                : '当前行 · 3 秒'}
          </span>
          <code>{hintMessage}</code>
        </div>
      )}

      <div
        className={`dictation-editor-shell ${
          checkState === 'wrong'
            ? 'has-error'
            : ''
        }`}
      >
        <Editor
          height={editorHeight}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          theme={
            editorTheme === 'dark'
              ? 'site-dark'
              : 'site-light'
          }
          language={language || 'plaintext'}
          value={draft}
          onChange={handleChange}
          options={{
            readOnly: false,
            domReadOnly: false,
            minimap: {
              enabled: false,
            },
            automaticLayout: true,
            autoIndent: 'full',
            formatOnType: false,
            formatOnPaste: false,
            tabSize: 2,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            overviewRulerBorder: false,
            wordWrap: 'off',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            suggestOnTriggerCharacters: false,
            quickSuggestions: false,
            parameterHints: {
              enabled: false,
            },
            inlineSuggest: {
              enabled: false,
            },
            renderValidationDecorations: 'off',
          }}
        />

        {checkState === 'wrong' && (
          <div className="dictation-feedback error">
            这里和答案不一致
          </div>
        )}
      </div>
    </div>
  );
}

export default DictationEditor;
