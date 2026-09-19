import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import {
  Prism as SyntaxHighlighter,
} from 'react-syntax-highlighter';

import DictationEditor from '../components/DictationEditor';
import KnowledgeKindTabs from '../components/KnowledgeKindTabs';
import { apiUrl } from '../lib/api';
import type { Category } from '../types/function';
import type {
  ArtifactFunction,
  CodeClassEntry,
  CodeFileEntry,
} from '../types/codeArtifact';
import './code-artifact-library.css';

type ArtifactMode = 'class' | 'file';
type Artifact = CodeClassEntry | CodeFileEntry;

type CodeArtifactLibraryPageProps = {
  mode: ArtifactMode;
};

const CATEGORY_LEVEL_LABELS = [
  '语言',
  '框架',
  '分类',
  '子分类',
] as const;

function getCategoryPath(
  categoryId: number | null | undefined,
  categories: Category[],
): Category[] {
  if (categoryId == null) {
    return [];
  }

  const result: Category[] = [];
  const visited = new Set<number>();
  let currentId: number | null = categoryId;

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categories.find(
      (item) => item.id === currentId,
    );

    if (!category) {
      break;
    }

    result.unshift(category);
    currentId = category.parentId;
  }

  return result;
}

function getDescendantIds(
  categoryId: number,
  categories: Category[],
): Set<number> {
  const result = new Set<number>([categoryId]);
  const queue = [categoryId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current == null) {
      continue;
    }

    categories.forEach((category) => {
      if (
        category.parentId === current &&
        !result.has(category.id)
      ) {
        result.add(category.id);
        queue.push(category.id);
      }
    });
  }

  return result;
}

function syntaxLanguage(language: string): string {
  switch (language.toLowerCase()) {
    case 'html':
      return 'markup';
    case 'typescript':
    case 'javascript':
    case 'dart':
    case 'kotlin':
    case 'java':
    case 'python':
    case 'css':
    case 'sql':
      return language.toLowerCase();
    default:
      return 'text';
  }
}

function monacoLanguage(
  variantLanguage: string | undefined,
  artifactLanguage: string,
): string {
  const language =
    variantLanguage && variantLanguage !== 'plaintext'
      ? variantLanguage
      : artifactLanguage;

  if (language.toLowerCase() === 'html') {
    return 'html';
  }

  return syntaxLanguage(language) === 'text'
    ? 'plaintext'
    : language.toLowerCase();
}

function isCodeClassEntry(
  item: Artifact,
): item is CodeClassEntry {
  return 'methods' in item && !('classes' in item);
}

function CodeArtifactLibraryPage({
  mode,
}: CodeArtifactLibraryPageProps) {
  const [items, setItems] = useState<Artifact[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeCategoryId, setActiveCategoryId] =
    useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFunctionId, setSelectedFunctionId] =
    useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] =
    useState<number | null>(null);
  const [dictationMode, setDictationMode] = useState(false);

  const endpoint = mode === 'class' ? '/api/classes' : '/api/files';
  const queryKey = mode === 'class' ? 'class' : 'file';

  useEffect(() => {
    setLoading(true);
    setItems([]);
    setSelectedId(null);
    setSelectedFunctionId(null);
    setSelectedVariantId(null);
    setDictationMode(false);

    Promise.all([
      fetch(apiUrl(endpoint)),
      fetch(apiUrl('/api/categories')),
    ])
      .then(async ([itemsResponse, categoriesResponse]) => {
        if (!itemsResponse.ok || !categoriesResponse.ok) {
          throw new Error('加载知识库失败');
        }

        const itemData: Artifact[] = await itemsResponse.json();
        const categoryData: Category[] = await categoriesResponse.json();
        setItems(itemData);
        setCategories(categoryData);

        const params = new URLSearchParams(window.location.search);
        const requestedId = Number(params.get(queryKey));
        const requested = Number.isSafeInteger(requestedId)
          ? itemData.find((item) => item.id === requestedId)
          : undefined;
        const initial = requested ?? itemData[0];

        if (initial) {
          setSelectedId(initial.id);
          setActiveCategoryId(initial.categoryId ?? null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [endpoint, queryKey]);

  const selected =
    selectedId == null
      ? null
      : items.find((item) => item.id === selectedId) ?? null;

  const selectedFunctions: ArtifactFunction[] = selected
    ? isCodeClassEntry(selected)
      ? selected.methods
      : selected.functions
    : [];

  const selectedFunction =
    selectedFunctionId == null
      ? null
      : selectedFunctions.find(
          (functionEntry) => functionEntry.id === selectedFunctionId,
        ) ?? null;

  const selectedVariant =
    selectedFunction?.variants.find(
      (variant) => variant.id === selectedVariantId,
    ) ??
    selectedFunction?.variants[0] ??
    null;

  const rootCategories = useMemo(
    () => categories.filter((category) => category.parentId === null),
    [categories],
  );

  const activePath =
    activeCategoryId == null
      ? []
      : getCategoryPath(activeCategoryId, categories);

  const categoryLevels: Category[][] = [rootCategories, [], [], []];

  for (let level = 1; level < CATEGORY_LEVEL_LABELS.length; level += 1) {
    const parent = activePath[level - 1];
    categoryLevels[level] = parent
      ? categories.filter((category) => category.parentId === parent.id)
      : [];
  }

  const visibleCategoryIds =
    activeCategoryId == null
      ? null
      : getDescendantIds(activeCategoryId, categories);
  const keyword = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (
      visibleCategoryIds &&
      (item.categoryId == null || !visibleCategoryIds.has(item.categoryId))
    ) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.code.toLowerCase().includes(keyword) ||
      item.description?.toLowerCase().includes(keyword)
    );
  });

  function selectItem(item: Artifact) {
    setSelectedId(item.id);
    setActiveCategoryId(item.categoryId ?? null);
    setSelectedFunctionId(null);
    setSelectedVariantId(null);
    setDictationMode(false);

    const url = new URL(window.location.href);
    url.searchParams.set(queryKey, String(item.id));
    window.history.replaceState({}, '', url);
  }

  function selectFunction(functionEntry: ArtifactFunction) {
    setSelectedFunctionId(functionEntry.id);
    setSelectedVariantId(functionEntry.variants[0]?.id ?? null);
    setDictationMode(false);
  }

  return (
    <div className="library-page artifact-library-page">
      <header className="library-header artifact-library-header">
        <div className="artifact-brand-block">
          <div>
            <h1>Function Base</h1>
            <p>代码结构知识库</p>
          </div>
          <KnowledgeKindTabs />
        </div>

        <div className="library-header-actions">
          <Link to="/review">随机抽查</Link>
          <Link to="/admin">🔒 管理后台</Link>
        </div>
      </header>

      <div className="artifact-searchbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            mode === 'class'
              ? '搜索 Class、代码...'
              : '搜索文件、代码...'
          }
        />
      </div>

      <main className="artifact-library-layout">
        <aside className="artifact-browser">
          <section className="artifact-taxonomy">
            <div className="artifact-taxonomy-title">
              <strong>浏览分类</strong>
              {activeCategoryId !== null && (
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(null)}
                >
                  全部
                </button>
              )}
            </div>

            {CATEGORY_LEVEL_LABELS.map((label, levelIndex) => (
              <div className="artifact-taxonomy-row" key={label}>
                <span>{label}</span>
                <div>
                  {categoryLevels[levelIndex].map((category) => {
                    const active =
                      activePath[levelIndex]?.id === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={active ? 'active' : ''}
                        onClick={() => setActiveCategoryId(category.id)}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="artifact-item-list">
            <div className="artifact-item-list-heading">
              <strong>{mode === 'class' ? 'Class' : '文件'}</strong>
              <span>{filteredItems.length}</span>
            </div>

            {loading ? (
              <p className="artifact-empty">加载中...</p>
            ) : filteredItems.length === 0 ? (
              <p className="artifact-empty">当前没有内容</p>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedId === item.id ? 'active' : ''}
                  onClick={() => selectItem(item)}
                >
                  <strong>{item.name}</strong>
                  <small>{item.categoryNode?.name ?? '未分类'}</small>
                </button>
              ))
            )}
          </section>
        </aside>

        <section className="artifact-detail">
          {!selected ? (
            <div className="artifact-empty-state">
              <h2>{mode === 'class' ? '还没有 Class' : '还没有文件'}</h2>
              <p>可以从管理后台新增，系统会自动抽取里面的函数。</p>
            </div>
          ) : (
            <>
              <div className="artifact-detail-heading">
                <div>
                  <span className="artifact-kind-badge">
                    {mode === 'class' ? 'CLASS' : 'FILE'}
                  </span>
                  <h1>{selected.name}</h1>
                  {selected.description && <p>{selected.description}</p>}
                </div>
              </div>

              <div className="artifact-meta-line">
                <span>{selected.language}</span>
                {selected.categoryId != null && (
                  <span>
                    {getCategoryPath(selected.categoryId, categories)
                      .map((category) => category.name)
                      .join(' → ')}
                  </span>
                )}
                {isCodeClassEntry(selected) && selected.sourceFile && (
                  <Link to={`/files?file=${selected.sourceFile.id}`}>
                    文件：{selected.sourceFile.name}
                  </Link>
                )}
              </div>

              {isCodeClassEntry(selected) ? (
                <section className="artifact-members">
                  <h2>方法 · {selected.methods.length}</h2>
                  <div className="artifact-member-grid">
                    {selected.methods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        className={
                          selectedFunctionId === method.id ? 'active' : ''
                        }
                        aria-pressed={selectedFunctionId === method.id}
                        onClick={() => selectFunction(method)}
                      >
                        <span>ƒ</span>
                        <strong>{method.name}</strong>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  <section className="artifact-members">
                    <h2>Class · {selected.classes.length}</h2>
                    <div className="artifact-member-grid">
                      {selected.classes.map((codeClass) => (
                        <Link
                          key={codeClass.id}
                          to={`/classes?class=${codeClass.id}`}
                        >
                          <span>C</span>
                          <strong>{codeClass.name}</strong>
                        </Link>
                      ))}
                    </div>
                  </section>

                  <section className="artifact-members">
                    <h2>函数 · {selected.functions.length}</h2>
                    <div className="artifact-member-grid">
                      {selected.functions.map((functionEntry) => (
                        <button
                          key={functionEntry.id}
                          type="button"
                          className={
                            selectedFunctionId === functionEntry.id
                              ? 'active'
                              : ''
                          }
                          aria-pressed={
                            selectedFunctionId === functionEntry.id
                          }
                          onClick={() => selectFunction(functionEntry)}
                        >
                          <span>ƒ</span>
                          <strong>{functionEntry.name}</strong>
                          {functionEntry.sourceClass && (
                            <small>{functionEntry.sourceClass.name}</small>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {selectedFunction && selectedVariant && (
                <section className="artifact-inline-function">
                  <div className="artifact-inline-function-heading">
                    <div>
                      <span className="artifact-kind-badge">FUNCTION</span>
                      <h2>{selectedFunction.name}</h2>
                    </div>

                    <div className="artifact-inline-function-actions">
                      <button
                        type="button"
                        className={dictationMode ? 'active' : ''}
                        onClick={() =>
                          setDictationMode((current) => !current)
                        }
                      >
                        {dictationMode ? '退出默写' : '默写'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFunctionId(null);
                          setSelectedVariantId(null);
                          setDictationMode(false);
                        }}
                      >
                        关闭
                      </button>
                    </div>
                  </div>

                  {selectedFunction.variants.length > 1 && (
                    <div className="artifact-inline-variant-tabs">
                      {selectedFunction.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          className={
                            selectedVariant.id === variant.id ? 'active' : ''
                          }
                          onClick={() => {
                            setSelectedVariantId(variant.id);
                            setDictationMode(false);
                          }}
                        >
                          {variant.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {dictationMode ? (
                    <DictationEditor
                      key={selectedVariant.id}
                      answer={selectedVariant.code}
                      language={monacoLanguage(
                        selectedVariant.language,
                        selected.language,
                      )}
                    />
                  ) : (
                    <>
                      <SyntaxHighlighter
                        language={syntaxLanguage(
                          selectedVariant.language !== 'plaintext'
                            ? selectedVariant.language
                            : selected.language,
                        )}
                        showLineNumbers
                        customStyle={{
                          borderRadius: '12px',
                          padding: '20px',
                        }}
                      >
                        {selectedVariant.code}
                      </SyntaxHighlighter>

                      {selectedVariant.explanation && (
                        <p className="artifact-inline-function-explanation">
                          {selectedVariant.explanation}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}

              <div className="artifact-code-heading">
                <h2>完整代码</h2>
              </div>

              <SyntaxHighlighter
                language={syntaxLanguage(selected.language)}
                showLineNumbers
                customStyle={{
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                {selected.code}
              </SyntaxHighlighter>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default CodeArtifactLibraryPage;
