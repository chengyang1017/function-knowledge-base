import type {
  Category,
  FunctionVariant,
} from './function';

export type ArtifactFunction = {
  id: number;
  name: string;
  sourceClassId?: number | null;
  variants: FunctionVariant[];
};

export type CodeClassEntry = {
  id: number;
  name: string;
  language: string;
  code: string;
  description?: string | null;
  categoryId?: number | null;
  categoryNode?: Category | null;
  sourceFileId?: number | null;
  sourceFile?: {
    id: number;
    name: string;
  } | null;
  methods: ArtifactFunction[];
  createdAt: string;
  updatedAt: string;
};

export type CodeFileEntry = {
  id: number;
  name: string;
  language: string;
  code: string;
  description?: string | null;
  categoryId?: number | null;
  categoryNode?: Category | null;
  classes: Array<{
    id: number;
    name: string;
    methods: ArtifactFunction[];
  }>;
  functions: Array<
    ArtifactFunction & {
      sourceClass?: {
        id: number;
        name: string;
      } | null;
    }
  >;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionPreview = {
  classes: Array<{
    name: string;
    methods: string[];
  }>;
  topLevelFunctions: string[];
};
