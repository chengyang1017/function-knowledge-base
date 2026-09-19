import { Link, useNavigate } from 'react-router-dom';

import CodeArtifactForm from '../components/CodeArtifactForm';

function NewFilePage() {
  const navigate = useNavigate();

  return (
    <main className="new-function-page">
      <header className="admin-header">
        <div>
          <h1>新增文件</h1>
          <p>粘贴完整代码文件，系统自动拆出 Class、Class 方法和顶层函数。</p>
        </div>
        <div className="admin-actions">
          <Link to="/admin">返回管理后台</Link>
          <Link to="/files">查看文件库</Link>
        </div>
      </header>

      <CodeArtifactForm
        mode="file"
        onCreated={(id) => navigate(`/files?file=${id}`)}
      />
    </main>
  );
}

export default NewFilePage;
