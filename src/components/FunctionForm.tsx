import { useEffect, useState, type FormEvent } from 'react';
import Editor, { type BeforeMount } from '@monaco-editor/react';

import { apiUrl } from '../lib/api';
import type { Category, Tag } from '../types/function';

export type VariantForm = {
  name: string;
  language: string;
  code: string;
  explanation: string;
  sourceName: string;
  sourceUrl: string;
};

export type FunctionFormValue = {
  name: string;
  description: string;
  categoryId: number | null;
  tagIds: number[];
  relatedFunctionIds: number[];
  variants: VariantForm[];
};

type FunctionOption = {
  id: number;
  name: string;
};

type FunctionFormProps = {
  initialValue?: FunctionFormValue;
  currentFunctionId?: number;
  submitLabel: string;
  onSubmit: (value: FunctionFormValue) => Promise<void>;
  message?: string;
};

type EditorTheme = 'light' | 'dark';

type LanguageOption = {
  id: string;
  label: string;
};

type MonacoLanguage = {
  id: string;
  aliases?: string[];
};

function getCategoryPath(
  category: Category,
  categories: Category[],
): string {
  const names = [category.name];
  let parentId = category.parentId;

  while (parentId !== null) {
    const parent = categories.find(
      (item) => item.id === parentId,
    );

    if (!parent) {
      break;
    }

    names.unshift(parent.name);
    parentId = parent.parentId;
  }

  return names.join(' → ');
}

function makeEmptyVariant(name = ''): VariantForm {
  return {
    name,
    language: 'plaintext',
    code: '',
    explanation: '',
    sourceName: '',
    sourceUrl: '',
  };
}

function FunctionForm({
  initialValue,
  currentFunctionId,
  submitLabel,
  onSubmit,
  message,
}: FunctionFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(
    initialValue?.description ?? '',
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    initialValue?.categoryId ?? null,
  );
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    initialValue?.tagIds ?? [],
  );
  const [
    selectedRelatedFunctionIds,
    setSelectedRelatedFunctionIds,
  ] = useState<number[]>(
    initialValue?.relatedFunctionIds ?? [],
  );
  const [variants, setVariants] = useState<VariantForm[]>(
    initialValue?.variants ?? [makeEmptyVariant('基础版')],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [functionOptions, setFunctionOptions] = useState<
    FunctionOption[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [editorTheme, setEditorTheme] = useState<EditorTheme>(
    () =>
      document.documentElement.dataset.theme === 'dark'
        ? 'dark'
        : 'light',
  );
  const [languageOptions, setLanguageOptions] = useState<
    LanguageOption[]
  >([{ id: 'plaintext', label: 'Plain Text' }]);

  useEffect(() => {
    const syncTheme = () => {
      setEditorTheme(
        document.documentElement.dataset.theme === 'dark'
          ? 'dark'
          : 'light',
      );
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function loadOptions() {
      const [
        categoriesResponse,
        tagsResponse,
        functionOptionsResponse,
      ] = await Promise.all([
        fetch(apiUrl('/api/categories')),
        fetch(apiUrl('/api/tags')),
        fetch(apiUrl('/api/function-options')),
      ]);

      if (!categoriesResponse.ok) {
        throw new Error('加载分类失败');
      }

      if (!tagsResponse.ok) {
        throw new Error('加载标签失败');
      }

      if (!functionOptionsResponse.ok) {
        throw new Error('加载相关函数选项失败');
      }

      const categoryData: Category[] =
        await categoriesResponse.json();
      const tagData: Tag[] = await tagsResponse.json();
      const functionOptionData: FunctionOption[] =
        await functionOptionsResponse.json();

      setCategories(categoryData);
      setTags(tagData);
      setFunctionOptions(functionOptionData);
    }

    loadOptions().catch((error) => {
      console.error(error);
      setFormMessage('加载分类、标签或相关函数失败');
    });
  }, []);

  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('site-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
        'editor.lineHighlightBackground': '#ffffff08',
        'editorLineNumber.foreground': '#8b98a9',
        'editorLineNumber.activeForeground': '#dbe7f5',
      },
    });

    monaco.editor.defineTheme('site-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
        'editor.lineHighlightBackground': '#00000008',
        'editorLineNumber.foreground': '#8a919d',
        'editorLineNumber.activeForeground': '#374151',
      },
    });

    const nextLanguages: LanguageOption[] = monaco.languages
      .getLanguages()
      .map((language: MonacoLanguage) => ({
        id: language.id,
        label: language.aliases?.[0] ?? language.id,
      }));

    if (
      !nextLanguages.some(
        (language) => language.id === 'plaintext',
      )
    ) {
      nextLanguages.push({
        id: 'plaintext',
        label: 'Plain Text',
      });
    }

    nextLanguages.sort((left, right) =>
      left.label.localeCompare(right.label),
    );

    setLanguageOptions((current) =>
      current.length > 1 ? current : nextLanguages,
    );
  };

  function toggleTag(tagId: number) {
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  function toggleRelatedFunction(functionId: number) {
    setSelectedRelatedFunctionIds((current) =>
      current.includes(functionId)
        ? current.filter((id) => id !== functionId)
        : [...current, functionId],
    );
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      makeEmptyVariant(),
    ]);
  }

  function updateVariant(
    index: number,
    field: keyof VariantForm,
    value: string,
  ) {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    );
  }

  function removeVariant(index: number) {
    setVariants((current) =>
      current.filter(
        (_, variantIndex) => variantIndex !== index,
      ),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setFormMessage('请输入函数名');
      return;
    }

    if (categoryId === null) {
      setFormMessage('请选择分类');
      return;
    }

    const selectedCategoryHasChildren = categories.some(
      (category) => category.parentId === categoryId,
    );

    if (selectedCategoryHasChildren) {
      setFormMessage(
        '请选择最末级分类，父分类只能作为目录',
      );
      return;
    }

    if (variants.length === 0) {
      setFormMessage('至少需要一种写法');
      return;
    }

    const hasInvalidVariant = variants.some(
      (variant) =>
        !variant.name.trim() || !variant.code.trim(),
    );

    if (hasInvalidVariant) {
      setFormMessage(
        '每种写法都需要填写版本名称和代码',
      );
      return;
    }

    try {
      setSaving(true);
      setFormMessage('');

      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        categoryId,
        tagIds: selectedTagIds,
        relatedFunctionIds: selectedRelatedFunctionIds,
        variants: variants.map((variant) => ({
          name: variant.name.trim(),
          language:
            variant.language.trim() || 'plaintext',
          code: variant.code,
          explanation: variant.explanation.trim(),
          sourceName: variant.sourceName.trim(),
          sourceUrl: variant.sourceUrl.trim(),
        })),
      });
    } catch (error) {
      console.error(error);
      setFormMessage('保存失败');
    } finally {
      setSaving(false);
    }
  }

  const availableFunctionOptions = functionOptions.filter(
    (option) => option.id !== currentFunctionId,
  );

  return (
    <form onSubmit={handleSubmit}>
      <label>
        函数名
        <input
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
        />
      </label>

      <label>
        分类
        <select
          value={categoryId ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            setCategoryId(
              value === '' ? null : Number(value),
            );
          }}
        >
          <option value="">请选择分类</option>

          {categories.map((category) => {
            const hasChildren = categories.some(
              (item) => item.parentId === category.id,
            );

            return (
              <option
                key={category.id}
                value={category.id}
                disabled={hasChildren}
              >
                {getCategoryPath(category, categories)}
                {hasChildren ? '（分类组）' : ''}
              </option>
            );
          })}
        </select>
      </label>

      <label>
        说明
        <textarea
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
        />
      </label>

      <section className="tag-selector">
        <h2>标签</h2>

        {tags.length === 0 ? (
          <p>暂无标签，可以先到标签管理新增。</p>
        ) : (
          <div className="tag-options">
            {tags.map((tag) => {
              const selected =
                selectedTagIds.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  type="button"
                  className={
                    selected
                      ? 'tag-option active'
                      : 'tag-option'
                  }
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="related-function-selector">
        <h2>相关函数</h2>
        <p>选择与当前函数有直接知识关联的函数。</p>

        {availableFunctionOptions.length === 0 ? (
          <p>暂无可关联函数。</p>
        ) : (
          <div className="related-function-options">
            {availableFunctionOptions.map((option) => {
              const selected =
                selectedRelatedFunctionIds.includes(
                  option.id,
                );

              return (
                <button
                  key={option.id}
                  type="button"
                  className={
                    selected
                      ? 'related-function-option active'
                      : 'related-function-option'
                  }
                  aria-pressed={selected}
                  onClick={() =>
                    toggleRelatedFunction(option.id)
                  }
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <h2>写法版本</h2>

      {variants.map((variant, index) => {
        const hasCurrentLanguage = languageOptions.some(
          (language) =>
            language.id === variant.language,
        );

        return (
          <section
            key={index}
            className="variant-form"
          >
            <h3>写法 {index + 1}</h3>

            <label>
              版本名称
              <input
                value={variant.name}
                onChange={(event) =>
                  updateVariant(
                    index,
                    'name',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              编程语言
              <select
                value={variant.language}
                onChange={(event) =>
                  updateVariant(
                    index,
                    'language',
                    event.target.value,
                  )
                }
              >
                {!hasCurrentLanguage && (
                  <option value={variant.language}>
                    {variant.language}
                  </option>
                )}

                {languageOptions.map((language) => (
                  <option
                    key={language.id}
                    value={language.id}
                  >
                    {language.label} · {language.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              代码
              <Editor
                height="320px"
                beforeMount={handleEditorBeforeMount}
                theme={
                  editorTheme === 'dark'
                    ? 'site-dark'
                    : 'site-light'
                }
                language={
                  variant.language || 'plaintext'
                }
                value={variant.code}
                onChange={(value) =>
                  updateVariant(
                    index,
                    'code',
                    value ?? '',
                  )
                }
                options={{
                  minimap: {
                    enabled: false,
                  },
                  automaticLayout: true,
                  autoIndent: 'full',
                  formatOnType: true,
                  formatOnPaste: true,
                  tabSize: 2,
                  insertSpaces: true,
                  scrollBeyondLastLine: false,
                  overviewRulerBorder: false,
                }}
              />
            </label>

            <label>
              解释
              <textarea
                value={variant.explanation}
                onChange={(event) =>
                  updateVariant(
                    index,
                    'explanation',
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              来源名称
              <input
                value={variant.sourceName}
                onChange={(event) =>
                  updateVariant(
                    index,
                    'sourceName',
                    event.target.value,
                  )
                }
                placeholder="例如 Flutter 官方文档"
              />
            </label>

            <label>
              来源链接
              <input
                type="url"
                value={variant.sourceUrl}
                onChange={(event) =>
                  updateVariant(
                    index,
                    'sourceUrl',
                    event.target.value,
                  )
                }
                placeholder="https://..."
              />
            </label>

            {variants.length > 1 && (
              <button
                type="button"
                onClick={() => removeVariant(index)}
              >
                删除这个写法
              </button>
            )}
          </section>
        );
      })}

      <button type="button" onClick={addVariant}>
        + 添加另一种写法
      </button>

      <button type="submit" disabled={saving}>
        {saving ? '保存中...' : submitLabel}
      </button>

      {(formMessage || message) && (
        <p>{formMessage || message}</p>
      )}
    </form>
  );
}

export default FunctionForm;