import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Prism as SyntaxHighlighter,
} from 'react-syntax-highlighter';

import DictationEditor from './DictationEditor';
import type {
  Category,
  FunctionEntry,
  LearningStatus,
} from '../types/function';

type FunctionDetailProps = {
  functionEntry: FunctionEntry | null;
  categories: Category[];
  selectedTagId: number | null;
  tagCounts: Map<number, number>;
  onTagSelect: (tagId: number) => void;
  onRelatedFunctionSelect: (functionId: number) => void;
  onLearningStatusChange: (
    functionEntry: FunctionEntry,
    learningStatus: LearningStatus,
  ) => Promise<void>;
  onToggleFavorite: (functionEntry: FunctionEntry) => void;
  onSaveNote: (
    functionEntry: FunctionEntry,
    note: string,
  ) => Promise<void>;
};

function getRootCategory(
  categoryId: number | null | undefined,
  categories: Category[],
): Category | null {
  if (categoryId == null) {
    return null;
  }

  let current = categories.find(
    (category) => category.id === categoryId,
  );

  if (!current) {
    return null;
  }

  while (current.parentId !== null) {
    const parent = categories.find(
      (category) => category.id === current?.parentId,
    );

    if (!parent) {
      break;
    }

    current = parent;
  }

  return current;
}

function getCategoryPath(
  categoryId: number | null | undefined,
  categories: Category[],
): string | null {
  if (categoryId == null) {
    return null;
  }

  const category = categories.find(
    (item) => item.id === categoryId,
  );

  if (!category) {
    return null;
  }

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

function getSyntaxLanguage(
  functionEntry: FunctionEntry,
  categories: Category[],
): string {
  const rootCategory = getRootCategory(
    functionEntry.categoryId,
    categories,
  );

  switch (rootCategory?.name.toLowerCase()) {
    case 'dart':
      return 'dart';
    case 'typescript':
      return 'typescript';
    case 'javascript':
      return 'javascript';
    case 'kotlin':
      return 'kotlin';
    case 'java':
      return 'java';
    case 'python':
      return 'python';
    case 'html':
      return 'markup';
    case 'css':
      return 'css';
    case 'sql':
      return 'sql';
    default:
      return 'text';
  }
}

function getMonacoLanguage(
  variantLanguage: string | undefined,
  syntaxLanguage: string,
): string {
  if (
    variantLanguage &&
    variantLanguage !== 'plaintext'
  ) {
    return variantLanguage;
  }

  if (syntaxLanguage === 'markup') {
    return 'html';
  }

  if (syntaxLanguage === 'text') {
    return 'plaintext';
  }

  return syntaxLanguage;
}

function FunctionDetail({
  functionEntry,
  categories,
  selectedTagId,
  tagCounts,
  onTagSelect,
  onRelatedFunctionSelect,
  onLearningStatusChange,
  onToggleFavorite,
  onSaveNote,
}: FunctionDetailProps) {
  const [selectedVariantId, setSelectedVariantId] =
    useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [dictationMode, setDictationMode] = useState(false);
  const [noteDraft, setNoteDraft] = useState(
    functionEntry?.note ?? '',
  );
  const [savingNote, setSavingNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');

  useEffect(() => {
    setSelectedVariantId(null);
    setDictationMode(false);
    setNoteDraft(functionEntry?.note ?? '');
    setNoteMessage('');
    setCopied(false);
    setLinkCopied(false);
  }, [functionEntry?.id, functionEntry?.note]);

  const selectedVariant =
    functionEntry?.variants.find(
      (variant) => variant.id === selectedVariantId,
    ) ??
    functionEntry?.variants[0] ??
    null;

  async function copyFunctionLink() {
    await navigator.clipboard.writeText(
      window.location.href,
    );

    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function copyCode() {
    if (!selectedVariant) {
      return;
    }

    await navigator.clipboard.writeText(
      selectedVariant.code,
    );

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveNote() {
    if (!functionEntry) {
      return;
    }

    try {
      setSavingNote(true);
      setNoteMessage('');
      await onSaveNote(functionEntry, noteDraft);
      setNoteMessage('笔记已保存');
    } catch (error) {
      console.error(error);
      setNoteMessage('笔记保存失败');
    } finally {
      setSavingNote(false);
    }
  }

  if (!functionEntry) {
    return (
      <section className="function-detail">
        <p>暂无函数。</p>
      </section>
    );
  }

  const syntaxLanguage = getSyntaxLanguage(
    functionEntry,
    categories,
  );
  const categoryPath = getCategoryPath(
    functionEntry.categoryId,
    categories,
  );
  const monacoLanguage = getMonacoLanguage(
    selectedVariant?.language,
    syntaxLanguage,
  );

  return (
    <section className="function-detail">
      <div className="function-title-row">
        <h1>{functionEntry.name}</h1>

        <div className="function-title-actions">
          <button
            type="button"
            className="favorite-button"
            onClick={copyFunctionLink}
          >
            {linkCopied ? '✓ 链接已复制' : '复制链接'}
          </button>

          <button
            type="button"
            className="favorite-button"
            onClick={() => onToggleFavorite(functionEntry)}
          >
            {functionEntry.favorite ? '★ 已收藏' : '☆ 收藏'}
          </button>
        </div>
      </div>

      <section className="learning-status-control">
        <strong>学习状态</strong>

        <div className="learning-status-options">
          {([
            ['unlearned', '未学习'],
            ['learning', '学习中'],
            ['mastered', '已掌握'],
          ] as const).map(([status, label]) => (
            <button
              key={status}
              type="button"
              className={
                functionEntry.learningStatus === status
                  ? 'learning-status-option active'
                  : 'learning-status-option'
              }
              aria-pressed={
                functionEntry.learningStatus === status
              }
              onClick={() =>
                void onLearningStatusChange(
                  functionEntry,
                  status,
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {functionEntry.description && (
        <p>{functionEntry.description}</p>
      )}

      {categoryPath && (
        <p className="category-path">
          {categoryPath}
        </p>
      )}

      {(functionEntry.sourceClass || functionEntry.sourceFile) && (
        <div className="function-source-links">
          <span>来源</span>
          {functionEntry.sourceClass && (
            <Link to={`/classes?class=${functionEntry.sourceClass.id}`}>
              Class · {functionEntry.sourceClass.name}
            </Link>
          )}
          {functionEntry.sourceFile && (
            <Link to={`/files?file=${functionEntry.sourceFile.id}`}>
              文件 · {functionEntry.sourceFile.name}
            </Link>
          )}
        </div>
      )}

      {functionEntry.tags.length > 0 && (
        <div className="function-tags">
          {functionEntry.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={
                selectedTagId === tag.id
                  ? 'function-tag active'
                  : 'function-tag'
              }
              onClick={() => onTagSelect(tag.id)}
            >
              <span>{tag.name}</span>
              <span className="tag-count">
                {tagCounts.get(tag.id) ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {functionEntry.variants.length > 1 && (
        <div className="variant-tabs">
          {functionEntry.variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              className={
                selectedVariant?.id === variant.id
                  ? 'active'
                  : ''
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

      {selectedVariant && (
        <>
          <div className="variant-header">
            <h2>{selectedVariant.name}</h2>

            <div className="variant-header-actions">
              <button
                type="button"
                className={
                  dictationMode
                    ? 'dictation-toggle active'
                    : 'dictation-toggle'
                }
                onClick={() =>
                  setDictationMode(
                    (current) => !current,
                  )
                }
              >
                {dictationMode ? '退出默写' : '默写'}
              </button>

              {!dictationMode && (
                <button
                  type="button"
                  onClick={copyCode}
                >
                  {copied ? '✓ 已复制' : '复制'}
                </button>
              )}
            </div>
          </div>

          {dictationMode ? (
            <DictationEditor
              key={selectedVariant.id}
              answer={selectedVariant.code}
              language={monacoLanguage}
            />
          ) : (
            <>
              <SyntaxHighlighter
                language={syntaxLanguage}
                showLineNumbers
                customStyle={{
                  borderRadius: '10px',
                  padding: '20px',
                }}
              >
                {selectedVariant.code}
              </SyntaxHighlighter>

              {selectedVariant.explanation && (
                <p>{selectedVariant.explanation}</p>
              )}

              {selectedVariant.sourceName && (
                <p>
                  来源：
                  {selectedVariant.sourceUrl ? (
                    <a
                      href={selectedVariant.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selectedVariant.sourceName}
                    </a>
                  ) : (
                    selectedVariant.sourceName
                  )}
                </p>
              )}

              <section className="function-note">
                <h2>我的笔记</h2>

                <textarea
                  rows={8}
                  value={noteDraft}
                  onChange={(event) =>
                    setNoteDraft(event.target.value)
                  }
                  placeholder="记录你对这个函数的理解、注意事项和复用经验..."
                />

                <div className="function-note-actions">
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={savingNote}
                  >
                    {savingNote ? '保存中...' : '保存笔记'}
                  </button>

                  {noteMessage && <span>{noteMessage}</span>}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {functionEntry.relatedFunctions.length > 0 && (
        <section className="related-functions">
          <h2>相关函数</h2>

          <div className="related-functions-list">
            {functionEntry.relatedFunctions.map(
              (relatedFunction) => (
                <button
                  key={relatedFunction.id}
                  type="button"
                  onClick={() =>
                    onRelatedFunctionSelect(
                      relatedFunction.id,
                    )
                  }
                >
                  {relatedFunction.name}
                </button>
              ),
            )}
          </div>
        </section>
      )}
    </section>
  );
}

export default FunctionDetail;
