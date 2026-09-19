import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  Category,
  FunctionEntry,
  LearningStatus,
} from '../types/function';
import type {
  FunctionSort,
} from '../pages/FunctionLibraryPage';
import './library-top-nav.css';

type ViewCounts = Record<string, number>;

type LibraryTopNavProps = {
  categories: Category[];
  functions: FunctionEntry[];
  recentFunctions: FunctionEntry[];
  popularFunctions: FunctionEntry[];
  viewCounts: ViewCounts;
  selectedFunctionId: number | null;
  onSelect: (functionEntry: FunctionEntry) => void;
  onClearRecent: () => void;
  onClearViewCounts: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: FunctionSort;
  onSortChange: (value: FunctionSort) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  learningStatusFilter: LearningStatus | 'all';
  onLearningStatusFilterChange: (
    value: LearningStatus | 'all',
  ) => void;
};

const CATEGORY_LEVEL_LABELS = [
  '语言',
  '框架',
  '分类',
  '子分类',
] as const;

function getCategoryPath(
  categoryId: number,
  categories: Category[],
): Category[] {
  const path: Category[] = [];
  const visited = new Set<number>();
  let currentId: number | null = categoryId;

  while (currentId !== null) {
    if (visited.has(currentId)) {
      break;
    }

    visited.add(currentId);

    const category = categories.find(
      (item) => item.id === currentId,
    );

    if (!category) {
      break;
    }

    path.unshift(category);
    currentId = category.parentId;
  }

  return path;
}

function getDescendantIds(
  categoryId: number,
  categories: Category[],
): Set<number> {
  const ids = new Set<number>([categoryId]);
  const queue = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (currentId == null) {
      continue;
    }

    categories.forEach((category) => {
      if (
        category.parentId === currentId &&
        !ids.has(category.id)
      ) {
        ids.add(category.id);
        queue.push(category.id);
      }
    });
  }

  return ids;
}

function countFunctionsInCategory(
  categoryId: number,
  categories: Category[],
  functions: FunctionEntry[],
): number {
  const categoryIds = getDescendantIds(
    categoryId,
    categories,
  );

  return functions.filter(
    (functionEntry) =>
      functionEntry.categoryId != null &&
      categoryIds.has(functionEntry.categoryId),
  ).length;
}

function categoryLabel(
  functionEntry: FunctionEntry,
  categories: Category[],
): string {
  if (functionEntry.categoryId == null) {
    return '未分类';
  }

  return getCategoryPath(
    functionEntry.categoryId,
    categories,
  )
    .map((category) => category.name)
    .join(' › ');
}

function learningStatusLabel(
  status: LearningStatus,
): string {
  switch (status) {
    case 'mastered':
      return '已掌握';
    case 'learning':
      return '学习中';
    case 'unlearned':
    default:
      return '未学习';
  }
}

function LibraryTopNav({
  categories,
  functions,
  recentFunctions,
  popularFunctions,
  viewCounts,
  selectedFunctionId,
  onSelect,
  onClearRecent,
  onClearViewCounts,
  search,
  onSearchChange,
  sort,
  onSortChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  learningStatusFilter,
  onLearningStatusFilterChange,
}: LibraryTopNavProps) {
  const rootCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.parentId === null,
      ),
    [categories],
  );

  const selectedFunction =
    selectedFunctionId === null
      ? null
      : functions.find(
          (functionEntry) =>
            functionEntry.id === selectedFunctionId,
        ) ?? null;

  const [activeCategoryId, setActiveCategoryId] =
    useState<number | null>(null);

  const [categoryPanelOpen, setCategoryPanelOpen] =
    useState(true);

  useEffect(() => {
    if (selectedFunction?.categoryId != null) {
      setActiveCategoryId(
        selectedFunction.categoryId,
      );
    }
  }, [selectedFunction?.categoryId]);

  useEffect(() => {
    if (
      activeCategoryId !== null &&
      categories.some(
        (category) =>
          category.id === activeCategoryId,
      )
    ) {
      return;
    }

    setActiveCategoryId(
      rootCategories[0]?.id ?? null,
    );
  }, [
    activeCategoryId,
    categories,
    rootCategories,
  ]);

  const activePath =
    activeCategoryId === null
      ? []
      : getCategoryPath(
          activeCategoryId,
          categories,
        );

  const categoryLevels: Category[][] = [
    rootCategories,
    [],
    [],
    [],
  ];

  for (
    let levelIndex = 1;
    levelIndex < CATEGORY_LEVEL_LABELS.length;
    levelIndex += 1
  ) {
    const parentCategory =
      activePath[levelIndex - 1];

    categoryLevels[levelIndex] =
      parentCategory == null
        ? []
        : categories.filter(
            (category) =>
              category.parentId ===
              parentCategory.id,
          );
  }

  const activeCategory =
    activeCategoryId === null
      ? null
      : categories.find(
          (category) =>
            category.id === activeCategoryId,
        ) ?? null;

  const activeCategoryFunctions =
    activeCategoryId === null
      ? []
      : functions.filter(
          (functionEntry) =>
            functionEntry.categoryId ===
            activeCategoryId,
        );

  const searchActive =
    search.trim().length > 0;

  const collapsedPathLabel =
    activePath.length > 0
      ? activePath
          .map((category) => category.name)
          .join(' › ')
      : '尚未选择分类';

  function selectFunction(
    functionEntry: FunctionEntry,
  ) {
    onSelect(functionEntry);
  }

  function selectCategory(
    category: Category,
  ) {
    setActiveCategoryId(category.id);
  }

  return (
    <nav
      className={`library-top-nav ${
        categoryPanelOpen
          ? 'taxonomy-open'
          : 'taxonomy-collapsed'
      }`}
      aria-label="函数知识库导航"
    >
      <div className="library-workbench">
        <div className="library-workbench-search">
          <span
            className="library-search-icon"
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            type="search"
            placeholder="搜索函数、代码、分类..."
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
          />

          {searchActive && (
            <div className="library-search-results">
              <div className="library-search-results-heading">
                <strong>搜索结果</strong>
                <span>{functions.length}</span>
              </div>

              <div className="library-search-results-list">
                {functions.length > 0 ? (
                  functions.map((functionEntry) => (
                    <button
                      key={functionEntry.id}
                      type="button"
                      className={
                        selectedFunctionId ===
                        functionEntry.id
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        selectFunction(functionEntry)
                      }
                    >
                      <span>{functionEntry.name}</span>
                      <small>
                        {categoryLabel(
                          functionEntry,
                          categories,
                        )}
                      </small>
                    </button>
                  ))
                ) : (
                  <span className="library-search-empty">
                    没有找到匹配函数
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="library-workbench-actions">
          <select
            value={sort}
            onChange={(event) =>
              onSortChange(
                event.target.value as FunctionSort,
              )
            }
            aria-label="函数排序"
          >
            <option value="newest">最新添加</option>
            <option value="updated">最近更新</option>
            <option value="name">名称 A-Z</option>
            <option value="popular">最常浏览</option>
          </select>

          <select
            value={learningStatusFilter}
            onChange={(event) =>
              onLearningStatusFilterChange(
                event.target.value as
                  | LearningStatus
                  | 'all',
              )
            }
            aria-label="学习状态筛选"
          >
            <option value="all">全部学习状态</option>
            <option value="unlearned">未学习</option>
            <option value="learning">学习中</option>
            <option value="mastered">已掌握</option>
          </select>

          <button
            type="button"
            className={`library-favorite-toggle ${
              favoritesOnly ? 'active' : ''
            }`}
            aria-pressed={favoritesOnly}
            onClick={() =>
              onFavoritesOnlyChange(!favoritesOnly)
            }
          >
            {favoritesOnly ? '★' : '☆'} 收藏
          </button>

          {recentFunctions.length > 0 && (
            <details className="library-quick-menu">
              <summary>最近</summary>
              <div className="library-quick-menu-panel">
                <div className="library-quick-menu-title">
                  <strong>最近浏览</strong>
                  <button
                    type="button"
                    onClick={onClearRecent}
                  >
                    清除
                  </button>
                </div>

                {recentFunctions.map(
                  (functionEntry) => (
                    <button
                      key={functionEntry.id}
                      type="button"
                      onClick={() =>
                        selectFunction(functionEntry)
                      }
                    >
                      <span>{functionEntry.name}</span>
                      <small>
                        {categoryLabel(
                          functionEntry,
                          categories,
                        )}
                      </small>
                    </button>
                  ),
                )}
              </div>
            </details>
          )}

          {popularFunctions.length > 0 && (
            <details className="library-quick-menu">
              <summary>常用</summary>
              <div className="library-quick-menu-panel">
                <div className="library-quick-menu-title">
                  <strong>常用函数</strong>
                  <button
                    type="button"
                    onClick={onClearViewCounts}
                  >
                    清除
                  </button>
                </div>

                {popularFunctions.map(
                  (functionEntry) => (
                    <button
                      key={functionEntry.id}
                      type="button"
                      onClick={() =>
                        selectFunction(functionEntry)
                      }
                    >
                      <span>{functionEntry.name}</span>
                      <small>
                        {viewCounts[
                          String(functionEntry.id)
                        ] ?? 0}
                        {' '}次
                      </small>
                    </button>
                  ),
                )}
              </div>
            </details>
          )}
        </div>
      </div>

      <section className="library-taxonomy-panel">
        <div className="library-taxonomy-header">
          <div>
            <strong>浏览分类</strong>
            <span>
              {categoryPanelOpen
                ? '四层分类固定显示；未选中的下一层保持为空'
                : collapsedPathLabel}
            </span>
          </div>

          <button
            type="button"
            className="library-taxonomy-collapse"
            aria-expanded={categoryPanelOpen}
            onClick={() =>
              setCategoryPanelOpen(
                (current) => !current,
              )
            }
          >
            {categoryPanelOpen ? '收起' : '展开'}
          </button>
        </div>

        {categoryPanelOpen && (
          <>
            <div className="library-taxonomy-rows">
              {CATEGORY_LEVEL_LABELS.map(
                (label, levelIndex) => {
                  const levelCategories =
                    categoryLevels[levelIndex];

                  return (
                    <div
                      key={label}
                      className="library-taxonomy-row"
                    >
                      <div className="library-taxonomy-label">
                        {label}
                      </div>

                      <div className="library-taxonomy-options">
                        {levelCategories.map(
                          (category) => {
                            const active =
                              activePath[levelIndex]?.id ===
                              category.id;

                            const functionCount =
                              countFunctionsInCategory(
                                category.id,
                                categories,
                                functions,
                              );

                            return (
                              <button
                                key={category.id}
                                type="button"
                                className={`library-taxonomy-option ${
                                  active ? 'active' : ''
                                }`}
                                aria-pressed={active}
                                onClick={() =>
                                  selectCategory(category)
                                }
                              >
                                <span>{category.name}</span>
                                <small>
                                  {functionCount}
                                </small>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            {activeCategory && (
              <div className="library-function-shelf">
                <div className="library-function-shelf-heading">
                  <div>
                    <span>当前分类</span>
                    <strong>
                      {activeCategory.name}
                    </strong>
                  </div>

                  <span>
                    {activeCategoryFunctions.length}
                    {' '}个知识点
                  </span>
                </div>

                {activeCategoryFunctions.length > 0 ? (
                  <div className="library-function-grid">
                    {activeCategoryFunctions.map(
                      (functionEntry) => (
                        <button
                          key={functionEntry.id}
                          type="button"
                          className={`library-function-card ${
                            selectedFunctionId ===
                            functionEntry.id
                              ? 'active'
                              : ''
                          }`}
                          onClick={() =>
                            selectFunction(
                              functionEntry,
                            )
                          }
                        >
                          <span className="library-function-card-icon">
                            ƒ
                          </span>

                          <span className="library-function-card-copy">
                            <strong>
                              {functionEntry.name}
                            </strong>
                            <small>
                              {learningStatusLabel(
                                functionEntry
                                  .learningStatus,
                              )}
                            </small>
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="library-function-empty">
                    这个分类已经建立，但当前筛选下还没有知识点。
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </nav>
  );
}

export default LibraryTopNav;
