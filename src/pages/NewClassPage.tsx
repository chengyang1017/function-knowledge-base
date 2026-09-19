import { Link, useNavigate } from 'react-router-dom';

import CodeArtifactForm from '../components/CodeArtifactForm';

function NewClassPage() {
  const navigate = useNavigate();

  return (
    <main className="code-artifact-admin-page">
      <header className="admin-header">
        <div>
          <h1>新增 Class</h1>
          <p>粘贴完整 Class，系统自动识别并把每个方法加入函数库。</p>
        </div>
        <div className="admin-actions">
          <Link to="/admin">返回管理后台</Link>
          <Link to="/classes">查看 Class 库</Link>
        </div>
      </header>

      <CodeArtifactForm
        mode="class"
        onCreated={(id) => navigate(`/classes?class=${id}`)}
      />
    </main>
  );
}

export default NewClassPage;
