import type { Category, FunctionVariant } from './function';

export type ProjectStats = {
  files: number;
  classes: number;
  functions: number;
};

export type ProjectFileSummary = {
  id: number;
  name: string;
  projectPath?: string | null;
  language: string;
  updatedAt?: string;
  _count: {
    classes: number;
    functions: number;
  };
};

export type CodeProjectEntry = {
  id: number;
  name: string;
  description?: string | null;
  language: string;
  categoryId?: number | null;
  categoryNode?: Category | null;
  files: ProjectFileSummary[];
  stats: ProjectStats;
  createdAt: string;
  updatedAt: string;
};

export type ProjectFunction = {
  id: number;
  name: string;
  sourceClassId?: number | null;
  sourceClass?: {
    id: number;
    name: string;
  } | null;
  variants: FunctionVariant[];
};

export type ProjectClass = {
  id: number;
  name: string;
  methods: ProjectFunction[];
};

export type ProjectFileDetail = {
  id: number;
  name: string;
  language: string;
  code: string;
  projectId?: number | null;
  projectPath?: string | null;
  classes: ProjectClass[];
  functions: ProjectFunction[];
};
