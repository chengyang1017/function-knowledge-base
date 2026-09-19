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

function compactCode(value: string): string {
  return value.replace(/\s+/g, '');
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

  if (
    target.startsWith(beforeCursor) &&
    target.endsWith(afterCursor) &&
    beforeCursor.length + afterCursor.length <=
      target.length
  ) {
    return 'progress';
  }

  return 'wrong';
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

  const editorRef =
    useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef =
    useRef<Parameters<OnMount>[1] | null>(null);

  useEffect(() => {
    setDraft('');
    setCursorOffset(0);
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

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();

    if (!editor || !monaco || !model) {
      return;
    }

    if (checkState !== 'wrong') {
      monaco.editor.setModelMarkers(
        model,
        'dictation-check',
        [],
      );
      return;
    }

    const position = editor.getPosition() ?? {
      lineNumber: 1,
      column: 1,
    };
    const startColumn = Math.max(
      1,
      position.column - 1,
    );
    const endColumn = Math.max(
      startColumn + 1,
      position.column,
    );

    monaco.editor.setModelMarkers(
      model,
      'dictation-check',
      [
        {
          startLineNumber: position.lineNumber,
          startColumn,
          endLineNumber: position.lineNumber,
          endColumn,
          message: '这里和答案不一致',
          severity:
            monaco.MarkerSeverity.Error,
        },
      ],
    );
  }, [checkState, draft]);

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
    monaco,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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

  function handleChange(value: string | undefined) {
    const nextValue = value ?? '';
    setDraft(nextValue);

    const editor = editorRef.current;
    const position = editor?.getPosition();
    const model = editor?.getModel();

    if (position && model) {
      setCursorOffset(
        model.getOffsetAt(position),
      );
    }
  }

  return (
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
        }}
      />

      {checkState === 'wrong' && (
        <div className="dictation-feedback error">
          与答案不一致
        </div>
      )}
    </div>
  );
}

export default DictationEditor;
