import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import Editor, {
  type BeforeMount,
} from '@monaco-editor/react';

import { apiUrl } from '../lib/api';
import type { Category } from '../types/function';
import type { ExtractionPreview } from '../types/codeArtifact';
import './code-artifact-form.css';

type ArtifactMode = 'class' | 'file';

type CodeArtifactFormProps = {
  mode: ArtifactMode;
  onCreated: (id: number) => void;
};

const FUNCTION_CATEGORY_DEPTH = 3;
const LANGUAGES = [
  'dart',
  'typescript',
  'javascript',
  'java',
  'kotlin',
  'python',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'swift',
  'sql',
  'plaintext',
];

function getCategoryDepth(
  category: Category,
  categories: Category[],
): number | null {
  let depth = 0;
  let parentId = category.parentId;
  const visited = new Set<number>([category.id]);

  while (parentId !== null) {
    if (visited.has(parentId)) {
      return null;
    }

    visited.add(parentId);
    const parent = categories.find((item) => item.id === parentId);

    if (!parent) {
      return null;
    }

    depth += 1;
    parentId = parent.parentId;
  }

  return depth;
}

function categoryPath(
  category: Category,
  categories: Category[],
): string {
  const names = [category.name];
  let parentId = category.parentId;
  const visited = new Set<number>([category.id]);

  while (parentId !== null && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = categories.find((item) => item.id === parentId);

    if (!parent) {
      break;
    }

    names.unshift(parent.name);
    parentId = parent.parentId;
  }

  return names.join(' → ');
}

function CodeArtifactForm({
  mode,
  onCreated,
}: CodeArtifactFormProps) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('dart');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [preview, setPreview] = useState<ExtractionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    fetch(apiUrl('/api/categories'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('加载分类失败');
        }
        setCategories(await response.json());
      })
      .catch((error) => {
        console.error(error);
        setMessage('加载分类失败');
      });
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      setEditorTheme(
        document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      );
    };

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPreview(null);

    if (code.trim().length < 8) {
      return;
    }

    const timer = window.setTimeout(() => {
      void analyzeCode(false);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [code]);

  const selectableCategories = useMemo(
    () =>
      categories
        .filter((category) => {
          const depth = getCategoryDepth(category, categories);
          const hasChildren = categories.some(
            (item) => item.parentId === category.id,
          );
          return depth === FUNCTION_CATEGORY_DEPTH && !hasChildren;
        })
        .sort((left, right) =>
          categoryPath(left, categories).localeCompare(
            categoryPath(right, categories),
            'zh-CN',
          ),
        ),
    [categories],
  );

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('artifact-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
      },
    });
    monaco.editor.defineTheme('artifact-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
      },
    });
  };

  async function analyzeCode(showFailure = true) {
    if (!code.trim()) {
      return;
    }

    try {
      setPreviewing(true);
      const response = await fetch(apiUrl('/api/extract-preview'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        if (showFailure) {
          setMessage('代码分析失败');
        }
        return;
      }

      const result: ExtractionPreview = await response.json();
      setPreview(result);

      if (
        mode === 'class' &&
        !name.trim() &&
        result.classes.length === 1
      ) {
        setName(result.classes[0].name);
      }
    } catch (error) {
      console.error(error);
      if (showFailure) {
        setMessage('代码分析失败');
      }
    } finally {
      setPreviewing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (mode === 'file' && !name.trim()) {
      setMessage('请输入文件名');
      return;
    }

    if (!code.trim()) {
      setMessage('请输入代码');
      return;
    }

    if (categoryId === null) {
      setMessage('请选择子分类');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(
        apiUrl(mode === 'class' ? '/api/classes' : '/api/files'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            language,
            description: description.trim(),
            categoryId,
            code,
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(payload?.message ?? '保存失败');
        return;
      }

      onCreated(payload.id);
    } catch (error) {
      console.error(error);
      setMessage('保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="code-artifact-form" onSubmit={submit}>
      <div className="code-artifact-form-grid">
        <label>
          {mode === 'class' ? 'Class 名称' : '文件名'}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              mode === 'class'
                ? '可留空，系统从代码自动识别'
                : '例如 video_repository.dart'
            }
          />
        </label>

        <label>
          编程语言
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {LANGUAGES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="code-artifact-form-wide">
          子分类
          <select
            value={categoryId ?? ''}
            onChange={(event) =>
              setCategoryId(
                event.target.value ? Number(event.target.value) : null,
              )
            }
          >
            <option value="">请选择子分类</option>
            {selectableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryPath(category, categories)}
              </option>
            ))}
          </select>
        </label>

        <label className="code-artifact-form-wide">
          说明
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      <div className="code-artifact-editor-heading">
        <div>
          <strong>完整代码</strong>
          <span>
            {mode === 'class'
              ? '保存后自动抽取 Class 方法到函数库'
              : '保存后自动抽取 Class、Class 方法和顶层函数'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void analyzeCode(true)}
          disabled={previewing || !code.trim()}
        >
          {previewing ? '分析中...' : '重新分析'}
        </button>
      </div>

      <div className="code-artifact-editor-shell">
        <Editor
          height="520px"
          beforeMount={beforeMount}
          theme={editorTheme === 'dark' ? 'artifact-dark' : 'artifact-light'}
          language={language}
          value={code}
          onChange={(value) => setCode(value ?? '')}
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
          }}
        />
      </div>

      {preview && (
        <section className="code-extraction-preview">
          <div className="code-extraction-preview-heading">
            <strong>智能抽取结果</strong>
            <span>
              {preview.classes.length} 个 Class ·{' '}
              {preview.classes.reduce(
                (total, item) => total + item.methods.length,
                0,
              ) + preview.topLevelFunctions.length}{' '}
              个函数
            </span>
          </div>

          {preview.classes.map((item) => (
            <div className="code-extraction-class" key={item.name}>
              <strong>{item.name}</strong>
              <div>
                {item.methods.length > 0
                  ? item.methods.map((method) => (
                      <span key={`${item.name}-${method}`}>{method}()</span>
                    ))
                  : <span>没有识别到方法</span>}
              </div>
            </div>
          ))}

          {preview.topLevelFunctions.length > 0 && (
            <div className="code-extraction-class">
              <strong>顶层函数</strong>
              <div>
                {preview.topLevelFunctions.map((item) => (
                  <span key={item}>{item}()</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="code-artifact-form-actions">
        <button type="submit" disabled={saving}>
          {saving
            ? '保存中...'
            : mode === 'class'
              ? '保存 Class 并抽取函数'
              : '保存文件并智能拆分'}
        </button>
        {message && <span>{message}</span>}
      </div>
    </form>
  );
}

export default CodeArtifactForm;
