import { useState } from 'react';
import { Link } from 'react-router-dom';

import FunctionForm, {
  type FunctionFormValue,
} from '../components/FunctionForm';
import { apiUrl } from '../lib/api';

function NewFunctionPage() {
  const [message, setMessage] = useState('');

  async function createFunction(
    value: FunctionFormValue,
  ) {
    const response = await fetch(
      apiUrl('/api/functions'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: value.name,
          description: value.description || null,
          categoryId: value.categoryId,
          tagIds: value.tagIds,
          relatedFunctionIds:
            value.relatedFunctionIds,
          variants: value.variants.map(
            (variant) => ({
              name: variant.name,
              language:
                variant.language || 'plaintext',
              code: variant.code,
              explanation:
                variant.explanation || null,
              sourceName:
                variant.sourceName || null,
              sourceUrl:
                variant.sourceUrl || null,
            }),
          ),
        }),
      },
    );

    if (!response.ok) {
      throw new Error('创建函数失败');
    }

    setMessage('函数保存成功');
  }

  return (
    <main className="new-function-page">
      <header className="admin-header">
        <div>
          <h1>新增函数</h1>
          <p>添加新的函数知识和写法版本。</p>
        </div>

        <Link to="/admin/functions">
          返回函数管理
        </Link>
      </header>

      <FunctionForm
        submitLabel="保存函数"
        onSubmit={createFunction}
        message={message}
      />
    </main>
  );
}

export default NewFunctionPage;
