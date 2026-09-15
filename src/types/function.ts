export type FunctionVariant = {
  id: number;
  name: string;
  language: string;
  code: string;
  explanation?: string | null;

  sourceName?: string | null;
  sourceUrl?: string | null;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
};

export type Tag = {
  id: number;
  name: string;
  slug: string;
};

export type RelatedFunction = {
  id: number;
  name: string;
};

export type LearningStatus =
  | 'unlearned'
  | 'learning'
  | 'mastered';

export type FunctionEntry = {
  id: number;
  name: string;
  description?: string | null;

  categoryId?: number | null;
  categoryNode?: Category | null;

  variants: FunctionVariant[];
  tags: Tag[];
  relatedFunctions: RelatedFunction[];

  favorite: boolean;
  learningStatus: LearningStatus;
  note?: string | null;

  createdAt: string;
  updatedAt: string;
};