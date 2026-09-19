import { prisma } from './lib/prisma.js';

const FUNCTION_CATEGORY_DEPTH = 3;
const UNCATEGORIZED_NAME = '未分类';

type CategoryNode = {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
};

function getCategoryDepth(
  category: CategoryNode,
  categoriesById: Map<number, CategoryNode>,
): number | null {
  const visited = new Set<number>([category.id]);
  let depth = 0;
  let parentId = category.parentId;

  while (parentId !== null) {
    if (visited.has(parentId)) {
      return null;
    }

    visited.add(parentId);

    const parent = categoriesById.get(parentId);

    if (!parent) {
      return null;
    }

    depth += 1;
    parentId = parent.parentId;
  }

  return depth;
}

function hasChildren(
  categoryId: number,
  categoriesById: Map<number, CategoryNode>,
): boolean {
  for (const category of categoriesById.values()) {
    if (category.parentId === categoryId) {
      return true;
    }
  }

  return false;
}

function getAncestorAtDepth(
  category: CategoryNode,
  targetDepth: number,
  categoriesById: Map<number, CategoryNode>,
): CategoryNode | null {
  let current: CategoryNode | undefined = category;
  const visited = new Set<number>();

  while (current) {
    if (visited.has(current.id)) {
      return null;
    }

    visited.add(current.id);

    const depth = getCategoryDepth(current, categoriesById);

    if (depth === targetDepth) {
      return current;
    }

    if (
      depth === null ||
      depth < targetDepth ||
      current.parentId === null
    ) {
      return null;
    }

    current = categoriesById.get(current.parentId);
  }

  return null;
}

async function createUniqueUncategorizedChild(
  parentId: number | null,
  depth: number,
  categoriesById: Map<number, CategoryNode>,
): Promise<CategoryNode> {
  const existing = await prisma.category.findFirst({
    where: {
      parentId,
      name: UNCATEGORIZED_NAME,
    },
    orderBy: {
      id: 'asc',
    },
  });

  if (existing) {
    categoriesById.set(existing.id, existing);
    return existing;
  }

  const baseSlug =
    `auto-uncategorized-${parentId ?? 'root'}-${depth}`;
  let slug = baseSlug;
  let suffix = 1;

  while (
    await prisma.category.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const created = await prisma.category.create({
    data: {
      name: UNCATEGORIZED_NAME,
      slug,
      parentId,
    },
  });

  categoriesById.set(created.id, created);

  console.log(
    `[category-normalize] created ${UNCATEGORIZED_NAME} at depth ${depth}: ${created.slug}`,
  );

  return created;
}

async function ensureLeafSubcategory(
  startCategory: CategoryNode | null,
  categoriesById: Map<number, CategoryNode>,
): Promise<CategoryNode> {
  let current = startCategory;
  let currentDepth = current
    ? getCategoryDepth(current, categoriesById)
    : -1;

  if (currentDepth === null) {
    throw new Error(
      `分类树损坏，无法计算分类 ${current?.id ?? 'null'} 的层级`,
    );
  }

  if (currentDepth > FUNCTION_CATEGORY_DEPTH) {
    const categoryLevelParent = getAncestorAtDepth(
      current!,
      FUNCTION_CATEGORY_DEPTH - 1,
      categoriesById,
    );

    if (!categoryLevelParent) {
      throw new Error(
        `无法为分类 ${current!.id} 找到第 ${FUNCTION_CATEGORY_DEPTH} 层父分类`,
      );
    }

    current = categoryLevelParent;
    currentDepth = FUNCTION_CATEGORY_DEPTH - 1;
  }

  if (
    current &&
    currentDepth === FUNCTION_CATEGORY_DEPTH &&
    !hasChildren(current.id, categoriesById)
  ) {
    return current;
  }

  if (current && currentDepth === FUNCTION_CATEGORY_DEPTH) {
    if (current.parentId === null) {
      throw new Error(`分类 ${current.id} 缺少父分类`);
    }

    const parent = categoriesById.get(current.parentId);

    if (!parent) {
      throw new Error(`分类 ${current.id} 的父分类不存在`);
    }

    current = parent;
    currentDepth = FUNCTION_CATEGORY_DEPTH - 1;
  }

  while (currentDepth < FUNCTION_CATEGORY_DEPTH) {
    const nextDepth = currentDepth + 1;

    current = await createUniqueUncategorizedChild(
      current?.id ?? null,
      nextDepth,
      categoriesById,
    );

    currentDepth = nextDepth;
  }

  return current!;
}

async function normalizeExistingFunctions() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
    },
  });

  const categoriesById = new Map<number, CategoryNode>(
    categories.map((category) => [category.id, category]),
  );

  const functions = await prisma.functionEntry.findMany({
    select: {
      id: true,
      name: true,
      categoryId: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  let movedCount = 0;

  for (const functionEntry of functions) {
    const currentCategory =
      functionEntry.categoryId === null
        ? null
        : categoriesById.get(functionEntry.categoryId) ?? null;

    const currentDepth = currentCategory
      ? getCategoryDepth(currentCategory, categoriesById)
      : null;

    const alreadyValid =
      currentCategory !== null &&
      currentDepth === FUNCTION_CATEGORY_DEPTH &&
      !hasChildren(currentCategory.id, categoriesById);

    if (alreadyValid) {
      continue;
    }

    const targetCategory = await ensureLeafSubcategory(
      currentCategory,
      categoriesById,
    );

    await prisma.functionEntry.update({
      where: {
        id: functionEntry.id,
      },
      data: {
        categoryId: targetCategory.id,
      },
    });

    movedCount += 1;

    console.log(
      `[category-normalize] moved ${functionEntry.name} -> ${targetCategory.id} (${UNCATEGORIZED_NAME})`,
    );
  }

  console.log(
    `[category-normalize] ${movedCount} function(s) moved to deepest subcategories`,
  );
}

async function installFunctionCategoryGuard() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION enforce_function_entry_subcategory()
    RETURNS trigger AS $$
    DECLARE
      category_depth integer;
    BEGIN
      IF NEW."categoryId" IS NULL THEN
        RAISE EXCEPTION 'FunctionEntry.categoryId must reference a subcategory'
          USING ERRCODE = '23514';
      END IF;

      WITH RECURSIVE ancestry AS (
        SELECT c.id, c."parentId", 0 AS depth
        FROM "Category" c
        WHERE c.id = NEW."categoryId"

        UNION ALL

        SELECT parent.id, parent."parentId", ancestry.depth + 1
        FROM "Category" parent
        JOIN ancestry ON ancestry."parentId" = parent.id
        WHERE ancestry.depth < 16
      )
      SELECT MAX(depth)
      INTO category_depth
      FROM ancestry;

      IF category_depth IS NULL OR category_depth <> 3 THEN
        RAISE EXCEPTION 'Functions must reference a fourth-level subcategory'
          USING ERRCODE = '23514';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM "Category"
        WHERE "parentId" = NEW."categoryId"
      ) THEN
        RAISE EXCEPTION 'Functions must reference a leaf subcategory'
          USING ERRCODE = '23514';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS function_entry_subcategory_guard
    ON "FunctionEntry";
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER function_entry_subcategory_guard
    BEFORE INSERT OR UPDATE OF "categoryId"
    ON "FunctionEntry"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_function_entry_subcategory();
  `);

  console.log('[category-normalize] database guard installed');
}

async function main() {
  await normalizeExistingFunctions();
  await installFunctionCategoryGuard();
}

main()
  .catch((error) => {
    console.error('[category-normalize] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
