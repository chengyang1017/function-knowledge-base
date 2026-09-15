import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import FunctionForm, {
  type FunctionFormValue,
} from '../components/FunctionForm';
import { apiUrl } from '../lib/api';
import type { FunctionEntry } from '../types/function';

function EditFunctionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const functionId = Number(id);

  const [initialValue, setInitialValue] =
    useState<FunctionFormValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setInitialValue(null);
    setMessage('');

    async function loadFunction() {
      if (
        !Number.isSafeInteger(functionId) ||
        functionId <= 0
      ) {
        if (!active) return;

        setMessage('无效的函数 ID');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          apiUrl(`/api/functions/${functionId}`),
        );

        if (!response.ok) {
          throw new Error('函数加载失败');
        }

        const data: FunctionEntry =
          await response.json();

        if (!active) {
          return;
        }

        setInitialValue({
          name: data.name,
          description: data.description ?? '',
          categoryId: data.categoryId ?? null,
          tagIds: data.tags.map((tag) => tag.id),
          relatedFunctionIds:
            data.relatedFunctions.map(
              (relatedFunction) =>
                relatedFunction.id,
            ),
          variants: data.variants.map(
            (variant) => ({
              name: variant.name,
              language:
                variant.language || 'plaintext',
              code: variant.code,
              explanation:
                variant.explanation ?? '',
              sourceName:
                variant.sourceName ?? '',
              sourceUrl:
                variant.sourceUrl ?? '',
            }),
          ),
        });
      } catch (error) {
        if (!active) {
          return;
        }

        console.error(error);
        setMessage('加载函数失败');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFunction();

    return () => {
      active = false;
    };
  }, [functionId]);

  async function updateFunction(
    value: FunctionFormValue,
  ) {
    const response = await fetch(
      apiUrl(`/api/functions/${functionId}`),
      {
        method: 'PUT',
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
      throw new Error('更新函数失败');
    }

    setMessage('保存成功');

    setTimeout(() => {
      navigate('/admin/functions');
    }, 700);
  }

  if (loading) {
    return (
      <main className="new-function-page">
        <p>加载中...</p>
      </main>
    );
  }

  if (!initialValue) {
    return (
      <main className="new-function-page">
        <p>{message || '函数不存在'}</p>

        <Link to="/admin/functions">
          返回函数管理
        </Link>
      </main>
    );
  }

  return (
    <main className="new-function-page">
      <header className="admin-header">
        <div>
          <h1>编辑函数</h1>
          <p>修改函数信息和写法版本。</p>
        </div>

        <Link to="/admin/functions">
          返回函数管理
        </Link>
      </header>

      <FunctionForm
        initialValue={initialValue}
        currentFunctionId={functionId}
        submitLabel="保存修改"
        onSubmit={updateFunction}
        message={message}
      />
    </main>
  );
}

export default EditFunctionPage;
