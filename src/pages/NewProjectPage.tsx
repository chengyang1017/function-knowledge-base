import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiUrl } from '../lib/api';
import type { Category } from '../types/function';
import './new-project.css';

type ImportedFile = {
  path: string;
  code: string;
  bytes: number;
};

function getCategoryPath(categoryId: number, categories: Category[]) {
  const names: string[] = [];
  const visited = new Set<number>();
  let currentId: number | null = categoryId;

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categories.find((item) => item.id === currentId);
    if (!category) {
      break;
    }
    names.unshift(category.name);
    currentId = category.parentId;
  }

  return names.join(' → ');
}

function NewProjectPage() {
  const navigate = useNavigate();
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [folderName, setFolderName] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const input = directoryInputRef.current;
    if (input) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    }

    fetch(apiUrl('/api/categories'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('加载分类失败');
        }
        return response.json() as Promise<Category[]>;
      })
      .then(setCategories)
      .catch(console.error);
  }, []);

  const leafCategories = useMemo(() => {
    const parentIds = new Set(
      categories
        .map((category) => category.parentId)
        .filter((id): id is number => id != null),
    );

    return categories
      .filter((category) => !parentIds.has(category.id))
      .map((category) => ({
        category,
        path: getCategoryPath(category.id, categories),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }, [categories]);

  const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
  const folders = new Set(
    files
      .map((file) => file.path.split('/').slice(0, -1).join('/'))
      .filter(Boolean),
  ).size;

  async function chooseDirectory(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setReading(true);
    setMessage('');

    try {
      const selectedFiles = Array.from(fileList);
      const firstPath = selectedFiles[0]?.webkitRelativePath ?? selectedFiles[0]?.name ?? '';
      const rootName = firstPath.split('/')[0] ?? '';
      const dartFiles = selectedFiles.filter((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        const normalized = relativePath.replaceAll('\\', '/');
        const libMarker = normalized.indexOf('/lib/');
        const startsAtLib = normalized.startsWith('lib/');
        return (
          file.name.endsWith('.dart') &&
          (libMarker >= 0 || startsAtLib)
        );
      });

      if (dartFiles.length === 0) {
        setFiles([]);
        setFolderName(rootName);
        setMessage('这个目录的 lib 下没有找到 Dart 文件。');
        return;
      }

      if (dartFiles.length > 300) {
        setMessage('lib 下超过 300 个 Dart 文件，请先缩小项目范围。');
        return;
      }

      const imported = await Promise.all(
        dartFiles.map(async (file): Promise<ImportedFile> => {
          const relativePath = (file.webkitRelativePath || file.name).replaceAll('\\', '/');
          const marker = relativePath.indexOf('lib/');
          const path = marker >= 0 ? relativePath.slice(marker) : relativePath;
          const code = await file.text();
          return {
            path,
            code,
            bytes: new Blob([code]).size,
          };
        }),
      );

      const tooLarge = imported.find((file) => file.bytes > 1024 * 1024);
      if (tooLarge) {
        setMessage(`${tooLarge.path} 超过 1 MB，暂时不能导入。`);
        return;
      }

      const bytes = imported.reduce((total, file) => total + file.bytes, 0);
      if (bytes > 15 * 1024 * 1024) {
        setMessage('lib 代码总量超过 15 MB，暂时不能导入。');
        return;
      }

      imported.sort((left, right) => left.path.localeCompare(right.path));
      setFiles(imported);
      setFolderName(rootName);
      if (!name.trim() && rootName) {
        setName(rootName);
      }
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!name.trim()) {
      setMessage('请输入项目名称。');
      return;
    }
    if (categoryId === '') {
      setMessage('请选择最底层子分类。');
      return;
    }
    if (files.length === 0) {
      setMessage('请先选择 Flutter 项目目录。');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          categoryId,
          files: files.map((file) => ({
            path: file.path,
            code: file.code,
          })),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || '导入项目失败');
      }

      navigate(`/projects?project=${body.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入项目失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="new-project-page">
      <header className="admin-header">
        <div>
          <h1>导入项目</h1>
          <p>只读取 Flutter 项目的 lib 目录，用于代码阅读、结构浏览和函数学习，不运行项目。</p>
        </div>

        <div className="admin-actions">
          <Link to="/projects">项目阅读</Link>
          <Link to="/admin">返回管理后台</Link>
        </div>
      </header>

      <section className="project-import-card">
        <div className="project-import-grid">
          <label>
            <span>项目名称</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如 Clyven"
            />
          </label>

          <label>
            <span>归类到</span>
            <select
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">请选择子分类</option>
              {leafCategories.map(({ category, path }) => (
                <option key={category.id} value={category.id}>
                  {path}
                </option>
              ))}
            </select>
          </label>

          <label className="project-import-wide">
            <span>说明（可选）</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="这个项目主要用来学习什么..."
            />
          </label>
        </div>

        <div className="project-folder-picker">
          <div>
            <strong>选择 Flutter 项目目录</strong>
            <p>浏览器只会读取你选择目录里的 <code>lib/**/*.dart</code>；android、ios、assets、build、.dart_tool 都不会上传。</p>
          </div>

          <label className="project-folder-button">
            {reading ? '读取中...' : files.length > 0 ? '重新选择目录' : '选择项目目录'}
            <input
              ref={directoryInputRef}
              type="file"
              multiple
              disabled={reading || saving}
              onChange={(event) => void chooseDirectory(event.target.files)}
            />
          </label>
        </div>

        {files.length > 0 && (
          <section className="project-import-preview">
            <div className="project-import-preview-head">
              <div>
                <strong>{folderName || name || '项目'}</strong>
                <span>只导入 lib</span>
              </div>
              <div>
                <span>{files.length} 文件</span>
                <span>{folders} 目录</span>
                <span>{(totalBytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <div className="project-import-file-list">
              {files.slice(0, 120).map((file) => (
                <div key={file.path}>
                  <span>◇</span>
                  <code>{file.path}</code>
                  <small>{(file.bytes / 1024).toFixed(1)} KB</small>
                </div>
              ))}
              {files.length > 120 && (
                <p>还有 {files.length - 120} 个文件，导入时会全部处理。</p>
              )}
            </div>
          </section>
        )}

        <div className="project-import-actions">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || reading || files.length === 0}
          >
            {saving ? '正在建立项目索引...' : '导入并建立阅读工作区'}
          </button>
          {message && <span>{message}</span>}
        </div>
      </section>
    </main>
  );
}

export default NewProjectPage;
