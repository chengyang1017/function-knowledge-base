import {
  useEffect,
  useState,
} from 'react';
import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  logoutAdmin,
} from '../lib/adminAuth';
import { apiUrl } from '../lib/api';
import type { CodeProjectEntry } from '../types/project';
import './admin-projects.css';

function AdminPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<CodeProjectEntry[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [projectMessage, setProjectMessage] = useState('');

  useEffect(() => {
    fetch(apiUrl('/api/projects'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('加载项目失败');
        }

        return response.json() as Promise<CodeProjectEntry[]>;
      })
      .then(setProjects)
      .catch((error) => {
        console.error(error);
        setProjectMessage(
          error instanceof Error
            ? error.message
            : '加载项目失败',
        );
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  async function handleLock() {
    await logoutAdmin();

    navigate(
      '/',
      {
        replace: true,
      },
    );
  }

  async function deleteProject(project: CodeProjectEntry) {
    if (deletingProjectId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除项目「${project.name}」？\n\n` +
        `会同时删除 ${project.stats.files} 个文件、` +
        `${project.stats.classes} 个 Class 和 ` +
        `${project.stats.functions} 个自动抽取函数。\n\n此操作无法撤销。`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setProjectMessage('');

    try {
      const response = await fetch(
        apiUrl(`/api/projects/${project.id}`),
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `服务器返回 ${response.status}`);
      }

      setProjects((current) =>
        current.filter((item) => item.id !== project.id),
      );
      localStorage.removeItem(`function-base-project-read-status:${project.id}`);
      localStorage.removeItem(`function-base-project-recent-files:${project.id}`);
      setProjectMessage(`已删除项目「${project.name}」。`);
    } catch (error) {
      console.error(error);
      setProjectMessage(
        error instanceof Error
          ? `删除失败：${error.message}`
          : '删除失败，请稍后重试。',
      );
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <h1>管理后台</h1>

          <p>
            管理项目、函数、Class、文件、分类和标签。
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            onClick={() =>
              void handleLock()
            }
          >
            🔒 锁定后台
          </button>

          <Link to="/">
            返回知识库
          </Link>
        </div>
      </header>

      <section className="admin-menu">
        <Link
          to="/admin/projects/new"
          className="admin-card"
        >
          <h2>导入项目</h2>

          <p>
            选择 Flutter 项目目录，只读取 lib 下的 Dart 文件并建立项目阅读工作区。
          </p>
        </Link>

        <Link
          to="/admin/functions"
          className="admin-card"
        >
          <h2>函数管理</h2>

          <p>
            新增、编辑和删除独立函数知识。
          </p>
        </Link>

        <Link
          to="/admin/classes/new"
          className="admin-card"
        >
          <h2>新增 Class</h2>

          <p>
            粘贴完整 Class，自动抽取所有方法进入函数库。
          </p>
        </Link>

        <Link
          to="/admin/files/new"
          className="admin-card"
        >
          <h2>新增文件</h2>

          <p>
            导入完整文件，自动拆出 Class、方法和顶层函数。
          </p>
        </Link>

        <Link
          to="/admin/categories"
          className="admin-card"
        >
          <h2>分类管理</h2>

          <p>
            项目与三类知识共用语言、框架、分类、子分类四层树。
          </p>
        </Link>

        <Link
          to="/admin/tags"
          className="admin-card"
        >
          <h2>标签管理</h2>

          <p>
            管理函数的横向知识标签。
          </p>
        </Link>
      </section>

      <section className="admin-project-manager">
        <div className="admin-project-manager-heading">
          <div>
            <h2>项目管理</h2>
            <p>项目删除只在管理员后台提供。</p>
          </div>
          <Link to="/admin/projects/new">导入新项目</Link>
        </div>

        {projectMessage && (
          <div className="admin-project-message" role="status">
            {projectMessage}
          </div>
        )}

        {loadingProjects ? (
          <p className="admin-project-empty">正在加载项目…</p>
        ) : projects.length === 0 ? (
          <p className="admin-project-empty">目前还没有项目。</p>
        ) : (
          <div className="admin-project-list">
            {projects.map((project) => (
              <article key={project.id} className="admin-project-row">
                <div>
                  <strong>{project.name}</strong>
                  <span>
                    {project.stats.files} 文件 · {project.stats.classes} Class · {project.stats.functions} 函数
                  </span>
                </div>

                <div className="admin-project-row-actions">
                  <Link to={`/projects?project=${project.id}`}>
                    打开阅读
                  </Link>
                  <button
                    type="button"
                    className="admin-project-delete"
                    disabled={deletingProjectId !== null}
                    onClick={() => void deleteProject(project)}
                  >
                    {deletingProjectId === project.id ? '正在删除…' : '删除项目'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminPage;
