import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Link } from 'react-router-dom';

import KnowledgeKindTabs from '../components/KnowledgeKindTabs';
import { apiUrl } from '../lib/api';
import type {
  CodeProjectEntry,
  ProjectFileDetail,
  ProjectFileSummary,
  ProjectFunction,
} from '../types/project';
import './project-reader.css';

type TreeNode = {
  name: string;
  path: string;
  file?: ProjectFileSummary;
  children: TreeNode[];
};

type ReadStatus = 'unread' | 'reading' | 'read';

function buildTree(files: ProjectFileSummary[]): TreeNode[] {
  const root: TreeNode = {
    name: 'root',
    path: '',
    children: [],
  };

  for (const file of files) {
    const path = file.projectPath ?? `lib/${file.name}`;
    const parts = path.split('/').filter(Boolean);
    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = current.children.find((item) => item.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          children: [],
        };
        current.children.push(node);
      }

      if (index === parts.length - 1) {
        node.file = file;
      }

      current = node;
    });
  }

  function sort(nodes: TreeNode[]) {
    nodes.sort((left, right) => {
      const leftFolder = left.file == null;
      const rightFolder = right.file == null;
      if (leftFolder !== rightFolder) {
        return leftFolder ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
    nodes.forEach((node) => sort(node.children));
  }

  sort(root.children);
  return root.children;
}

function readStatusKey(projectId: number) {
  return `function-base-project-read-status:${projectId}`;
}

function recentFileKey(projectId: number) {
  return `function-base-project-recent-files:${projectId}`;
}

function loadStatuses(projectId: number): Record<string, ReadStatus> {
  try {
    const raw = localStorage.getItem(readStatusKey(projectId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadRecentFiles(projectId: number): number[] {
  try {
    const raw = localStorage.getItem(recentFileKey(projectId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === 'number')
      : [];
  } catch {
    return [];
  }
}

function getFunctionCode(item: ProjectFunction): string {
  return item.variants[0]?.code ?? '';
}

function ProjectReaderPage() {
  const [projects, setProjects] = useState<CodeProjectEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<ProjectFileDetail | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(['lib']),
  );
  const [readStatuses, setReadStatuses] = useState<Record<string, ReadStatus>>({});
  const [recentFileIds, setRecentFileIds] = useState<number[]>([]);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/projects'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('加载项目失败');
        }
        return response.json() as Promise<CodeProjectEntry[]>;
      })
      .then((data) => {
        setProjects(data);
        const params = new URLSearchParams(window.location.search);
        const requestedId = Number(params.get('project'));
        const initial =
          (Number.isSafeInteger(requestedId)
            ? data.find((project) => project.id === requestedId)
            : undefined) ?? data[0];

        if (initial) {
          setSelectedProjectId(initial.id);
        }
      })
      .catch(console.error);
  }, []);

  const selectedProject =
    selectedProjectId == null
      ? null
      : projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProjectId == null) {
      setSelectedFileId(null);
      setSelectedFile(null);
      setReadStatuses({});
      setRecentFileIds([]);
      return;
    }

    setReadStatuses(loadStatuses(selectedProjectId));
    const recents = loadRecentFiles(selectedProjectId);
    setRecentFileIds(recents);

    const params = new URLSearchParams(window.location.search);
    const requestedFile = Number(params.get('file'));
    const file =
      (selectedProject && Number.isSafeInteger(requestedFile)
        ? selectedProject.files.find((item) => item.id === requestedFile)
        : undefined) ??
      selectedProject?.files.find((item) => item.id === recents[0]) ??
      null;

    setSelectedFileId(file?.id ?? null);
    setSelectedFile(null);
  }, [selectedProjectId, selectedProject]);

  useEffect(() => {
    if (selectedProjectId == null || selectedFileId == null) {
      setSelectedFile(null);
      return;
    }

    setLoadingFile(true);
    fetch(apiUrl(`/api/projects/${selectedProjectId}/files/${selectedFileId}`))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('加载项目文件失败');
        }
        return response.json() as Promise<ProjectFileDetail>;
      })
      .then((data) => {
        setSelectedFile(data);
      })
      .catch(console.error)
      .finally(() => setLoadingFile(false));
  }, [selectedProjectId, selectedFileId]);

  const tree = useMemo(
    () => buildTree(selectedProject?.files ?? []),
    [selectedProject],
  );

  const keyword = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!selectedProject || !keyword) {
      return [];
    }

    const results: Array<{
      key: string;
      kind: '文件' | 'Class' | '函数';
      label: string;
      file: ProjectFileSummary;
      functionName?: string;
    }> = [];

    for (const file of selectedProject.files) {
      const path = file.projectPath ?? file.name;
      if (path.toLowerCase().includes(keyword)) {
        results.push({
          key: `file-${file.id}`,
          kind: '文件',
          label: path,
          file,
        });
      }

      for (const codeClass of file.classes ?? []) {
        if (codeClass.name.toLowerCase().includes(keyword)) {
          results.push({
            key: `class-${codeClass.id}`,
            kind: 'Class',
            label: codeClass.name,
            file,
          });
        }

        for (const method of codeClass.methods) {
          if (method.name.toLowerCase().includes(keyword)) {
            results.push({
              key: `method-${method.id}`,
              kind: '函数',
              label: method.name,
              file,
              functionName: method.name,
            });
          }
        }
      }

      for (const fn of file.functions ?? []) {
        if (fn.name.toLowerCase().includes(keyword)) {
          results.push({
            key: `function-${fn.id}`,
            kind: '函数',
            label: fn.name,
            file,
            functionName: fn.name,
          });
        }
      }
    }

    return results.slice(0, 60);
  }, [selectedProject, keyword]);

  function selectProject(projectId: number) {
    setSelectedProjectId(projectId);
    setSelectedFileId(null);
    setSelectedFile(null);
    setSearch('');
    const url = new URL(window.location.href);
    url.searchParams.set('project', String(projectId));
    url.searchParams.delete('file');
    window.history.replaceState({}, '', url);
  }

  function selectFile(file: ProjectFileSummary, functionName?: string) {
    if (selectedProjectId == null) {
      return;
    }

    setSelectedFileId(file.id);
    const url = new URL(window.location.href);
    url.searchParams.set('project', String(selectedProjectId));
    url.searchParams.set('file', String(file.id));
    window.history.replaceState({}, '', url);

    const nextRecent = [
      file.id,
      ...recentFileIds.filter((id) => id !== file.id),
    ].slice(0, 8);
    setRecentFileIds(nextRecent);
    localStorage.setItem(recentFileKey(selectedProjectId), JSON.stringify(nextRecent));

    const nextStatuses: Record<string, ReadStatus> = {
      ...readStatuses,
      [String(file.id)]: readStatuses[String(file.id)] === 'read' ? 'read' : 'reading',
    };
    setReadStatuses(nextStatuses);
    localStorage.setItem(readStatusKey(selectedProjectId), JSON.stringify(nextStatuses));

    if (functionName) {
      window.setTimeout(() => revealSymbol(functionName), 180);
    }
  }

  function setReadStatus(status: ReadStatus) {
    if (selectedProjectId == null || selectedFileId == null) {
      return;
    }

    const next = {
      ...readStatuses,
      [String(selectedFileId)]: status,
    };
    setReadStatuses(next);
    localStorage.setItem(readStatusKey(selectedProjectId), JSON.stringify(next));
  }

  function revealSymbol(name: string, exactCode?: string) {
    const instance = editorRef.current;
    if (!instance || !selectedFile) {
      return;
    }

    const source = selectedFile.code;
    const index = exactCode ? source.indexOf(exactCode) : source.indexOf(name);
    if (index < 0) {
      return;
    }

    const line = source.slice(0, index).split('\n').length;
    instance.revealLineInCenter(line);
    instance.setPosition({ lineNumber: line, column: 1 });
    instance.focus();

    decorationRef.current?.clear();
    decorationRef.current = instance.createDecorationsCollection([
      {
        range: {
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'project-reader-highlight-line',
        },
      },
    ]);

    window.setTimeout(() => decorationRef.current?.clear(), 1200);
  }

  function renderTree(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      const isFolder = node.file == null;
      const expanded = expandedPaths.has(node.path);
      const status = node.file ? readStatuses[String(node.file.id)] ?? 'unread' : null;

      return (
        <div key={node.path} className="project-tree-node">
          <button
            type="button"
            className={
              node.file?.id === selectedFileId
                ? 'project-tree-row active'
                : 'project-tree-row'
            }
            style={{ paddingLeft: `${10 + depth * 15}px` }}
            onClick={() => {
              if (isFolder) {
                setExpandedPaths((current) => {
                  const next = new Set(current);
                  if (expanded) {
                    next.delete(node.path);
                  } else {
                    next.add(node.path);
                  }
                  return next;
                });
              } else if (node.file) {
                selectFile(node.file);
              }
            }}
          >
            <span className="project-tree-icon">
              {isFolder ? (expanded ? '▾' : '▸') : '◇'}
            </span>
            <span className="project-tree-name">{node.name}</span>
            {node.file && (
              <span className={`project-read-dot ${status}`} title={status ?? ''} />
            )}
          </button>

          {isFolder && expanded && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  }

  const currentStatus =
    selectedFileId == null
      ? 'unread'
      : readStatuses[String(selectedFileId)] ?? 'unread';

  const recentFiles =
    selectedProject?.files.filter((file) => recentFileIds.includes(file.id))
      .sort((a, b) => recentFileIds.indexOf(a.id) - recentFileIds.indexOf(b.id)) ?? [];

  return (
    <div className="project-reader-page">
      <header className="project-reader-header">
        <div className="project-reader-brand">
          <div>
            <h1>Function Base</h1>
            <p>项目阅读工作区</p>
          </div>
          <KnowledgeKindTabs />
        </div>

        <div className="project-reader-header-actions">
          <Link to="/admin/projects/new">导入项目</Link>
          <Link to="/admin">🔒 管理后台</Link>
        </div>
      </header>

      <div className="project-reader-toolbar">
        <select
          value={selectedProjectId ?? ''}
          onChange={(event) => selectProject(Number(event.target.value))}
          aria-label="选择项目"
        >
          {projects.length === 0 && <option value="">暂无项目</option>}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <div className="project-reader-search">
          <span>⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索文件 / Class / 函数"
          />
          {keyword && (
            <div className="project-search-results">
              {searchResults.length === 0 ? (
                <p>没有匹配结果</p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.key}
                    type="button"
                    onClick={() => {
                      selectFile(result.file, result.functionName);
                      setSearch('');
                    }}
                  >
                    <span>{result.kind}</span>
                    <strong>{result.label}</strong>
                    <small>{result.file.projectPath ?? result.file.name}</small>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedProject && (
          <div className="project-reader-stats">
            <span>{selectedProject.stats.files} 文件</span>
            <span>{selectedProject.stats.classes} Class</span>
            <span>{selectedProject.stats.functions} 函数</span>
          </div>
        )}
      </div>

      {!selectedProject ? (
        <main className="project-reader-empty">
          <div>
            <span className="project-reader-empty-icon">⌘</span>
            <h2>还没有导入项目</h2>
            <p>导入 Flutter 项目后这里只读取 lib 下的 Dart 文件，不运行项目。</p>
            <Link to="/admin/projects/new">导入第一个项目</Link>
          </div>
        </main>
      ) : (
        <main className="project-reader-workspace">
          <aside className="project-explorer">
            <div className="project-pane-heading">
              <div>
                <strong>PROJECT</strong>
                <span>{selectedProject.name}</span>
              </div>
            </div>
            <div className="project-tree">{renderTree(tree)}</div>
          </aside>

          <section className="project-editor-pane">
            {!selectedFileId ? (
              <div className="project-overview">
                <span className="artifact-kind-badge">PROJECT</span>
                <h1>{selectedProject.name}</h1>
                {selectedProject.description && <p>{selectedProject.description}</p>}

                <div className="project-overview-stats">
                  <div><strong>{selectedProject.stats.files}</strong><span>文件</span></div>
                  <div><strong>{selectedProject.stats.classes}</strong><span>Class</span></div>
                  <div><strong>{selectedProject.stats.functions}</strong><span>函数</span></div>
                </div>

                {recentFiles.length > 0 && (
                  <section className="project-recent-section">
                    <h2>继续阅读</h2>
                    <div>
                      {recentFiles.map((file) => (
                        <button key={file.id} type="button" onClick={() => selectFile(file)}>
                          <strong>{file.name}</strong>
                          <small>{file.projectPath}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : loadingFile || !selectedFile ? (
              <div className="project-editor-loading">正在读取文件...</div>
            ) : (
              <>
                <div className="project-editor-breadcrumb">
                  <span>{selectedProject.name}</span>
                  {(selectedFile.projectPath ?? selectedFile.name)
                    .split('/')
                    .filter(Boolean)
                    .map((part) => <span key={part}>{part}</span>)}
                </div>

                <div className="project-editor-shell">
                  <Editor
                    height="100%"
                    language="dart"
                    value={selectedFile.code}
                    theme="vs-dark"
                    onMount={(instance) => {
                      editorRef.current = instance;
                    }}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 15,
                      lineHeight: 24,
                      fontFamily: 'Cascadia Code, Cascadia Mono, Consolas, monospace',
                      folding: true,
                      glyphMargin: false,
                      renderLineHighlight: 'line',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: 'off',
                      contextmenu: true,
                      quickSuggestions: false,
                      suggestOnTriggerCharacters: false,
                    }}
                  />
                </div>

                <div className="project-editor-footer">
                  <span>{selectedFile.projectPath ?? selectedFile.name}</span>
                  <div className="project-read-status-control">
                    {([
                      ['unread', '未读'],
                      ['reading', '阅读中'],
                      ['read', '已读'],
                    ] as const).map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        className={currentStatus === status ? 'active' : ''}
                        onClick={() => setReadStatus(status)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="project-outline">
            <div className="project-pane-heading">
              <div>
                <strong>OUTLINE</strong>
                <span>{selectedFile?.name ?? '选择文件'}</span>
              </div>
            </div>

            {!selectedFile ? (
              <p className="project-outline-empty">选择左边的 Dart 文件查看结构。</p>
            ) : (
              <div className="project-outline-list">
                {selectedFile.classes.map((codeClass) => (
                  <div className="project-outline-class" key={codeClass.id}>
                    <button
                      type="button"
                      onClick={() => revealSymbol(codeClass.name)}
                    >
                      <span>C</span>
                      <strong>{codeClass.name}</strong>
                    </button>

                    {codeClass.methods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        className="method"
                        onClick={() =>
                          revealSymbol(method.name, getFunctionCode(method))
                        }
                      >
                        <span>ƒ</span>
                        <span>{method.name}</span>
                      </button>
                    ))}
                  </div>
                ))}

                {selectedFile.functions
                  .filter((fn) => !fn.sourceClassId)
                  .map((fn) => (
                    <button
                      key={fn.id}
                      type="button"
                      className="project-outline-function"
                      onClick={() => revealSymbol(fn.name, getFunctionCode(fn))}
                    >
                      <span>ƒ</span>
                      <strong>{fn.name}</strong>
                    </button>
                  ))}

                {selectedFile.classes.length === 0 &&
                  selectedFile.functions.length === 0 && (
                    <p className="project-outline-empty">这个文件没有识别到 Class 或函数。</p>
                  )}
              </div>
            )}
          </aside>
        </main>
      )}
    </div>
  );
}

export default ProjectReaderPage;