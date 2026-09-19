import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import LibraryTopNav from '../components/LibraryTopNav';
import FunctionDetail from '../components/FunctionDetail';
import KnowledgeKindTabs from '../components/KnowledgeKindTabs';

import type {
  Category,
  FunctionEntry,
  LearningStatus,
} from '../types/function';
import { apiUrl } from '../lib/api';

export type FunctionSort =
  | 'newest'
  | 'updated'
  | 'name'
  | 'popular';

const RECENT_FUNCTIONS_KEY =
  'function-base-recent-functions';

const VIEW_COUNTS_KEY =
  'function-base-view-counts';

const MAX_RECENT_FUNCTIONS = 8;

type ViewCounts = Record<string, number>;

function readRecentFunctionIds(): number[] {
  try {
    const raw = localStorage.getItem(
      RECENT_FUNCTIONS_KEY,
    );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is number =>
        typeof item === 'number',
    );
  } catch {
    return [];
  }
}

function readViewCounts(): ViewCounts {
  try {
    const raw = localStorage.getItem(
      VIEW_COUNTS_KEY,
    );

    if (!raw) {
      return {};
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    const result: ViewCounts = {};

    Object.entries(parsed).forEach(
      ([key, value]) => {
        if (
          typeof value === 'number'
        ) {
          result[key] = value;
        }
      },
    );

    return result;
  } catch {
    return {};
  }
}

function FunctionLibraryPage() {
  const [functions, setFunctions] =
    useState<FunctionEntry[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [
    selectedFunction,
    setSelectedFunction,
  ] =
    useState<FunctionEntry | null>(
      null,
    );

  const [search, setSearch] =
    useState('');

  const [
    selectedTagId,
    setSelectedTagId,
  ] =
    useState<number | null>(
      null,
    );

  const [
    favoritesOnly,
    setFavoritesOnly,
  ] =
    useState(false);

  const [
    learningStatusFilter,
    setLearningStatusFilter,
  ] = useState<LearningStatus | 'all'>(
    'all',
  );

  const [sort, setSort] =
    useState<FunctionSort>(
      'newest',
    );

  const [
    recentFunctionIds,
    setRecentFunctionIds,
  ] =
    useState<number[]>(
      () =>
        readRecentFunctionIds(),
    );

  const [
    viewCounts,
    setViewCounts,
  ] =
    useState<ViewCounts>(
      () => readViewCounts(),
    );

  useEffect(() => {
    async function loadData() {
      const [
        functionsResponse,
        categoriesResponse,
      ] =
        await Promise.all([
          fetch(
            apiUrl('/api/functions'),
          ),

          fetch(
            apiUrl('/api/categories'),
          ),
        ]);

      if (!functionsResponse.ok) {
        throw new Error('加载函数失败');
      }

      if (!categoriesResponse.ok) {
        throw new Error('加载分类失败');
      }

      const functionData:
        FunctionEntry[] =
        await functionsResponse.json();

      const categoryData:
        Category[] =
        await categoriesResponse.json();

      setFunctions(functionData);
      setCategories(categoryData);

      if (
        functionData.length > 0
      ) {
        const urlParams =
          new URLSearchParams(
            window.location.search,
          );

        const linkedFunctionId =
          Number(
            urlParams.get(
              'function',
            ),
          );

        const linkedFunction =
          Number.isNaN(
            linkedFunctionId,
          )
            ? undefined
            : functionData.find(
                (functionEntry) =>
                  functionEntry.id ===
                  linkedFunctionId,
              );

        const initialFunction =
          linkedFunction ??
          functionData[0];

        if (initialFunction) {
          setSelectedFunction(
            initialFunction,
          );

          const url =
            new URL(window.location.href);

          url.searchParams.set(
            'function',
            String(initialFunction.id),
          );

          window.history.replaceState(
            {},
            '',
            url,
          );
        }
      }
    }

    loadData().catch(
      console.error,
    );
  }, []);

  function recordRecentFunction(
    functionEntry: FunctionEntry,
  ) {
    setRecentFunctionIds(
      (current) => {
        const next = [
          functionEntry.id,

          ...current.filter(
            (id) =>
              id !==
              functionEntry.id,
          ),
        ].slice(
          0,
          MAX_RECENT_FUNCTIONS,
        );

        localStorage.setItem(
          RECENT_FUNCTIONS_KEY,
          JSON.stringify(next),
        );

        return next;
      },
    );
  }

  function recordView(
    functionEntry: FunctionEntry,
  ) {
    setViewCounts(
      (current) => {
        const key =
          String(
            functionEntry.id,
          );

        const next = {
          ...current,

          [key]:
            (current[key] ?? 0) +
            1,
        };

        localStorage.setItem(
          VIEW_COUNTS_KEY,
          JSON.stringify(next),
        );

        return next;
      },
    );
  }

  function handleFunctionSelect(
    functionEntry: FunctionEntry,
  ) {
    setSelectedFunction(
      functionEntry,
    );

    const url =
      new URL(
        window.location.href,
      );

    url.searchParams.set(
      'function',
      String(
        functionEntry.id,
      ),
    );

    window.history.replaceState(
      {},
      '',
      url,
    );

    recordRecentFunction(
      functionEntry,
    );

    recordView(
      functionEntry,
    );
  }

  function handleRelatedFunctionSelect(
    functionId: number,
  ) {
    const relatedFunction =
      functions.find(
        (functionEntry) =>
          functionEntry.id === functionId,
      );

    if (!relatedFunction) {
      return;
    }

    setSearch('');
    setSelectedTagId(null);
    setFavoritesOnly(false);
    setLearningStatusFilter('all');

    handleFunctionSelect(
      relatedFunction,
    );
  }

  function clearRecentFunctions() {
    setRecentFunctionIds([]);

    localStorage.removeItem(
      RECENT_FUNCTIONS_KEY,
    );
  }

  function clearViewCounts() {
    setViewCounts({});

    localStorage.removeItem(
      VIEW_COUNTS_KEY,
    );
  }

  const recentFunctions =
    recentFunctionIds
      .map((id) =>
        functions.find(
          (functionEntry) =>
            functionEntry.id ===
            id,
        ),
      )
      .filter(
        (
          functionEntry,
        ): functionEntry is FunctionEntry =>
          functionEntry != null,
      );

  const popularFunctions = [
    ...functions,
  ]
    .filter(
      (functionEntry) =>
        (
          viewCounts[
            String(
              functionEntry.id,
            )
          ] ?? 0
        ) > 0,
    )
    .sort(
      (a, b) =>
        (
          viewCounts[
            String(b.id)
          ] ?? 0
        ) -
        (
          viewCounts[
            String(a.id)
          ] ?? 0
        ),
    )
    .slice(0, 5);

  const keyword =
    search
      .trim()
      .toLowerCase();

  const selectedTag =
    selectedTagId === null
      ? null
      : functions
          .flatMap(
            (functionEntry) =>
              functionEntry.tags,
          )
          .find(
            (tag) =>
              tag.id ===
              selectedTagId,
          ) ?? null;

  const tagCounts =
    new Map<number, number>();

  functions.forEach(
    (functionEntry) => {
      functionEntry.tags.forEach(
        (tag) => {
          tagCounts.set(
            tag.id,

            (
              tagCounts.get(
                tag.id,
              ) ?? 0
            ) + 1,
          );
        },
      );
    },
  );

  const filteredFunctions =
    functions.filter(
      (functionEntry) => {
        if (
          favoritesOnly &&
          !functionEntry.favorite
        ) {
          return false;
        }

        if (
          learningStatusFilter !== 'all' &&
          functionEntry.learningStatus !==
            learningStatusFilter
        ) {
          return false;
        }

        const matchesTag =
          selectedTagId === null ||
          functionEntry.tags.some(
            (tag) =>
              tag.id ===
              selectedTagId,
          );

        if (!matchesTag) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return (
          functionEntry.name
            .toLowerCase()
            .includes(
              keyword,
            ) ||

          functionEntry.description
            ?.toLowerCase()
            .includes(
              keyword,
            ) ||

          functionEntry.categoryNode?.name
            .toLowerCase()
            .includes(
              keyword,
            ) ||

          functionEntry.sourceClass?.name
            .toLowerCase()
            .includes(keyword) ||

          functionEntry.sourceFile?.name
            .toLowerCase()
            .includes(keyword) ||

          functionEntry.tags.some(
            (tag) =>
              tag.name
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              tag.slug
                .toLowerCase()
                .includes(
                  keyword,
                ),
          ) ||

          functionEntry.variants.some(
            (variant) =>
              variant.name
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              variant.code
                .toLowerCase()
                .includes(
                  keyword,
                ) ||

              variant.explanation
                ?.toLowerCase()
                .includes(
                  keyword,
                ) ||

              variant.sourceName
                ?.toLowerCase()
                .includes(
                  keyword,
                ),
          ) ||

          functionEntry.note
            ?.toLowerCase()
            .includes(
              keyword,
            )
        );
      },
    );

  const sortedFunctions = [
    ...filteredFunctions,
  ].sort(
    (a, b) => {
      switch (sort) {
        case 'updated':
          return (
            new Date(
              b.updatedAt,
            ).getTime() -
            new Date(
              a.updatedAt,
            ).getTime()
          );

        case 'name':
          return a.name.localeCompare(
            b.name,
          );

        case 'popular':
          return (
            (
              viewCounts[
                String(b.id)
              ] ?? 0
            ) -
            (
              viewCounts[
                String(a.id)
              ] ?? 0
            )
          );

        case 'newest':
        default:
          return (
            new Date(
              b.createdAt,
            ).getTime() -
            new Date(
              a.createdAt,
            ).getTime()
          );
      }
    },
  );

  function handleTagSelect(
    tagId: number,
  ) {
    setSelectedTagId(
      (current) =>
        current === tagId
          ? null
          : tagId,
    );
  }

  function clearTagFilter() {
    setSelectedTagId(null);
  }

  async function saveNote(
    functionEntry: FunctionEntry,
    note: string,
  ) {
    const response = await fetch(
      apiUrl(`/api/functions/${functionEntry.id}/note`),
      {
        method: 'PATCH',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          note,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        '保存笔记失败',
      );
    }

    const updatedFunction:
      FunctionEntry =
      await response.json();

    setFunctions(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            updatedFunction.id
              ? updatedFunction
              : item,
        ),
    );

    setSelectedFunction(
      updatedFunction,
    );
  }

  async function updateLearningStatus(
    functionEntry: FunctionEntry,
    learningStatus: LearningStatus,
  ) {
    const response =
      await fetch(
        apiUrl(
          `/api/functions/${functionEntry.id}/learning-status`,
        ),
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            learningStatus,
          }),
        },
      );

    if (!response.ok) {
      window.alert(
        '更新学习状态失败',
      );
      return;
    }

    const updatedFunction:
      FunctionEntry =
      await response.json();

    setFunctions(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            updatedFunction.id
              ? updatedFunction
              : item,
        ),
    );

    setSelectedFunction(
      (current) =>
        current?.id ===
        updatedFunction.id
          ? updatedFunction
          : current,
    );
  }

  async function toggleFavorite(
    functionEntry: FunctionEntry,
  ) {
    const nextFavorite =
      !functionEntry.favorite;

    const response =
      await fetch(
        apiUrl(`/api/functions/${functionEntry.id}/favorite`),
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              favorite:
                nextFavorite,
            }),
        },
      );

    if (!response.ok) {
      window.alert(
        '更新收藏状态失败',
      );
      return;
    }

    const updatedFunction:
      FunctionEntry =
      await response.json();

    setFunctions(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            updatedFunction.id
              ? updatedFunction
              : item,
        ),
    );

    setSelectedFunction(
      (current) =>
        current?.id ===
        updatedFunction.id
          ? updatedFunction
          : current,
    );
  }

  return (
    <div className="library-page">
      <header className="library-header artifact-library-header">
        <div className="artifact-brand-block">
          <div>
            <h1>
              Function Base
            </h1>

            <p>
              代码结构知识库
            </p>
          </div>

          <KnowledgeKindTabs />
        </div>

        <div className="library-header-actions">
          <Link to="/review">
            随机抽查
          </Link>

          <Link to="/admin">
            🔒 管理后台
          </Link>
        </div>
      </header>

      {selectedTag && (
        <div className="active-filter">
          <span>
            当前筛选：

            <strong>
              {selectedTag.name}
            </strong>
          </span>

          <button
            type="button"
            onClick={
              clearTagFilter
            }
          >
            × 清除
          </button>
        </div>
      )}

      <div className="library-layout">
        <LibraryTopNav
          categories={
            categories
          }
          functions={
            sortedFunctions
          }
          recentFunctions={
            recentFunctions
          }
          popularFunctions={
            popularFunctions
          }
          viewCounts={
            viewCounts
          }
          selectedFunctionId={
            selectedFunction?.id ??
            null
          }
          onSelect={
            handleFunctionSelect
          }
          onClearRecent={
            clearRecentFunctions
          }
          onClearViewCounts={
            clearViewCounts
          }
          search={search}
          onSearchChange={
            setSearch
          }
          sort={sort}
          onSortChange={
            setSort
          }
          favoritesOnly={
            favoritesOnly
          }
          onFavoritesOnlyChange={
            setFavoritesOnly
          }
          learningStatusFilter={
            learningStatusFilter
          }
          onLearningStatusFilterChange={
            setLearningStatusFilter
          }
        />

        <FunctionDetail
          key={
            selectedFunction?.id ??
            'none'
          }
          functionEntry={
            selectedFunction
          }
          categories={
            categories
          }
          selectedTagId={
            selectedTagId
          }
          tagCounts={
            tagCounts
          }
          onTagSelect={
            handleTagSelect
          }
          onRelatedFunctionSelect={
            handleRelatedFunctionSelect
          }
          onLearningStatusChange={
            updateLearningStatus
          }
          onToggleFavorite={
            toggleFavorite
          }
          onSaveNote={
            saveNote
          }
        />
      </div>
    </div>
  );
}

export default FunctionLibraryPage;


