import { Router } from 'express';

import { protectAdminWrites } from './adminAuth.js';
import {
  extractCodeUnits,
  extractSingleClass,
} from './codeExtraction.js';
import { prisma } from './lib/prisma.js';

const router = Router();

async function isLeafCategory(categoryId: unknown): Promise<boolean> {
  if (
    typeof categoryId !== 'number' ||
    !Number.isSafeInteger(categoryId) ||
    categoryId <= 0
  ) {
    return false;
  }

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      children: {
        none: {},
      },
    },
    select: {
      id: true,
    },
  });

  return category !== null;
}

const classInclude = {
  categoryNode: true,
  sourceFile: {
    select: {
      id: true,
      name: true,
    },
  },
  methods: {
    include: {
      variants: true,
      categoryNode: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

const fileInclude = {
  categoryNode: true,
  classes: {
    include: {
      methods: {
        include: {
          variants: true,
        },
        orderBy: {
          createdAt: 'asc' as const,
        },
      },
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  functions: {
    include: {
      variants: true,
      sourceClass: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

router.post(
  '/extract-preview',
  protectAdminWrites,
  async (request, response) => {
    const { code } = request.body;

    if (typeof code !== 'string' || !code.trim()) {
      return response.status(400).json({
        message: '请输入代码',
      });
    }

    const result = extractCodeUnits(code);

    response.json({
      classes: result.classes.map((item) => ({
        name: item.name,
        methods: item.methods.map((method) => method.name),
      })),
      topLevelFunctions: result.topLevelFunctions.map(
        (item) => item.name,
      ),
    });
  },
);

router.get('/classes', async (_request, response) => {
  const classes = await prisma.codeClass.findMany({
    include: classInclude,
    orderBy: {
      createdAt: 'desc',
    },
  });

  response.json(classes);
});

router.get('/classes/:id', async (request, response) => {
  const id = Number(request.params.id);

  if (!Number.isSafeInteger(id)) {
    return response.status(400).json({
      message: 'Invalid class id',
    });
  }

  const codeClass = await prisma.codeClass.findUnique({
    where: { id },
    include: classInclude,
  });

  if (!codeClass) {
    return response.status(404).json({
      message: 'Class not found',
    });
  }

  response.json(codeClass);
});

router.post(
  '/classes',
  protectAdminWrites,
  async (request, response) => {
    const {
      name,
      language,
      code,
      description,
      categoryId,
    } = request.body;

    if (typeof code !== 'string' || !code.trim()) {
      return response.status(400).json({
        message: '请输入 Class 代码',
      });
    }

    if (!(await isLeafCategory(categoryId))) {
      return response.status(400).json({
        message: 'Class 必须归到最底层子分类',
      });
    }

    const extractedClass = extractSingleClass(code);

    if (!extractedClass) {
      return response.status(400).json({
        message: '没有识别到 Class，请检查代码',
      });
    }

    const allClasses = extractCodeUnits(code).classes;

    if (allClasses.length > 1) {
      return response.status(400).json({
        message: '检测到多个 Class，请改用“新增文件”导入',
      });
    }

    const effectiveLanguage =
      typeof language === 'string' && language.trim()
        ? language.trim()
        : 'plaintext';
    const effectiveName =
      typeof name === 'string' && name.trim()
        ? name.trim()
        : extractedClass.name;

    try {
      const created = await prisma.$transaction(async (tx) => {
        const codeClass = await tx.codeClass.create({
          data: {
            name: effectiveName,
            language: effectiveLanguage,
            code,
            description:
              typeof description === 'string'
                ? description.trim() || null
                : null,
            categoryId,
          },
        });

        for (const method of extractedClass.methods) {
          await tx.functionEntry.create({
            data: {
              name: method.name,
              description: `从 Class ${effectiveName} 自动抽取`,
              language: effectiveLanguage,
              category: null,
              categoryId,
              sourceClassId: codeClass.id,
              extracted: true,
              variants: {
                create: {
                  name: 'Class 方法',
                  language: effectiveLanguage,
                  code: method.code,
                  sourceName: effectiveName,
                },
              },
            },
          });
        }

        return tx.codeClass.findUnique({
          where: {
            id: codeClass.id,
          },
          include: classInclude,
        });
      });

      response.status(201).json(created);
    } catch (error) {
      console.error(error);
      response.status(500).json({
        message: '创建 Class 失败',
      });
    }
  },
);

router.delete(
  '/classes/:id',
  protectAdminWrites,
  async (request, response) => {
    const id = Number(request.params.id);

    if (!Number.isSafeInteger(id)) {
      return response.status(400).json({
        message: 'Invalid class id',
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.functionEntry.deleteMany({
          where: {
            sourceClassId: id,
            extracted: true,
          },
        });
        await tx.codeClass.delete({
          where: { id },
        });
      });

      response.status(204).send();
    } catch (error) {
      console.error(error);
      response.status(500).json({
        message: '删除 Class 失败',
      });
    }
  },
);

router.get('/files', async (_request, response) => {
  const files = await prisma.codeFile.findMany({
    include: fileInclude,
    orderBy: {
      createdAt: 'desc',
    },
  });

  response.json(files);
});

router.get('/files/:id', async (request, response) => {
  const id = Number(request.params.id);

  if (!Number.isSafeInteger(id)) {
    return response.status(400).json({
      message: 'Invalid file id',
    });
  }

  const file = await prisma.codeFile.findUnique({
    where: { id },
    include: fileInclude,
  });

  if (!file) {
    return response.status(404).json({
      message: 'File not found',
    });
  }

  response.json(file);
});

router.post(
  '/files',
  protectAdminWrites,
  async (request, response) => {
    const {
      name,
      language,
      code,
      description,
      categoryId,
    } = request.body;

    if (typeof name !== 'string' || !name.trim()) {
      return response.status(400).json({
        message: '请输入文件名',
      });
    }

    if (typeof code !== 'string' || !code.trim()) {
      return response.status(400).json({
        message: '请输入文件代码',
      });
    }

    if (!(await isLeafCategory(categoryId))) {
      return response.status(400).json({
        message: '文件必须归到最底层子分类',
      });
    }

    const effectiveLanguage =
      typeof language === 'string' && language.trim()
        ? language.trim()
        : 'plaintext';
    const extraction = extractCodeUnits(code);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const file = await tx.codeFile.create({
          data: {
            name: name.trim(),
            language: effectiveLanguage,
            code,
            description:
              typeof description === 'string'
                ? description.trim() || null
                : null,
            categoryId,
          },
        });

        for (const extractedClass of extraction.classes) {
          const codeClass = await tx.codeClass.create({
            data: {
              name: extractedClass.name,
              language: effectiveLanguage,
              code: extractedClass.code,
              description: `从文件 ${file.name} 自动抽取`,
              categoryId,
              sourceFileId: file.id,
            },
          });

          for (const method of extractedClass.methods) {
            await tx.functionEntry.create({
              data: {
                name: method.name,
                description:
                  `从 ${file.name} / ${extractedClass.name} 自动抽取`,
                language: effectiveLanguage,
                category: null,
                categoryId,
                sourceClassId: codeClass.id,
                sourceFileId: file.id,
                extracted: true,
                variants: {
                  create: {
                    name: 'Class 方法',
                    language: effectiveLanguage,
                    code: method.code,
                    sourceName:
                      `${file.name} · ${extractedClass.name}`,
                  },
                },
              },
            });
          }
        }

        for (const topLevelFunction of extraction.topLevelFunctions) {
          await tx.functionEntry.create({
            data: {
              name: topLevelFunction.name,
              description: `从文件 ${file.name} 自动抽取`,
              language: effectiveLanguage,
              category: null,
              categoryId,
              sourceFileId: file.id,
              extracted: true,
              variants: {
                create: {
                  name: '文件顶层函数',
                  language: effectiveLanguage,
                  code: topLevelFunction.code,
                  sourceName: file.name,
                },
              },
            },
          });
        }

        return tx.codeFile.findUnique({
          where: {
            id: file.id,
          },
          include: fileInclude,
        });
      });

      response.status(201).json(created);
    } catch (error) {
      console.error(error);
      response.status(500).json({
        message: '创建文件知识失败',
      });
    }
  },
);

router.delete(
  '/files/:id',
  protectAdminWrites,
  async (request, response) => {
    const id = Number(request.params.id);

    if (!Number.isSafeInteger(id)) {
      return response.status(400).json({
        message: 'Invalid file id',
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.functionEntry.deleteMany({
          where: {
            sourceFileId: id,
            extracted: true,
          },
        });
        await tx.codeFile.delete({
          where: { id },
        });
      });

      response.status(204).send();
    } catch (error) {
      console.error(error);
      response.status(500).json({
        message: '删除文件失败',
      });
    }
  },
);

export default router;
