import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  logoutAdmin,
} from '../lib/adminAuth';

function AdminPage() {
  const navigate =
    useNavigate();

  async function handleLock() {
    await logoutAdmin();

    navigate(
      '/',
      {
        replace: true,
      },
    );
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
    </main>
  );
}

export default AdminPage;
