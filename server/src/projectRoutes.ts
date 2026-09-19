import { Router } from 'express';

import { protectAdminWrites } from './adminAuth.js';
import { extractCodeUnits } from './codeExtraction.js';
import { prisma } from './lib/prisma.js';

const router = Router();

const MAX_PROJECT_FILES = 300;
const MAX_PROJECT_BYTES = 15 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;

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
      children: { none: {} },
    },
    select: { id: true },
  });

  return category !== null;
}

const projectFileInclude = {
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

const projectFileSummarySelect = {
  id: true,
  name: true,
  projectPath: true,
  language: true,
  updatedAt: true,
  classes: {
    select: {
      id: true,
      name: true,
      methods: {
        select: {
          id: true,
          name: true,
          sourceClassId: true,
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
    select: {
      id: true,
      name: true,
      sourceClassId: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  _count: {
    select: {
      classes: true,
      functions: true,
    },
  },
};

router.get('/projects', async (_request, response) => {
  const projects = await prisma.codeProject.findMany({
    include: {
      categoryNode: true,
      files: {
        select: projectFileSummarySelect,
        orderBy: {
          projectPath: 'asc',
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  response.json(
    projects.map((project) => ({
      ...project,
      stats: {
        files: project.files.length,
        classes: project.files.reduce(
          (total, file) => total + file._count.classes,
          0,
        ),
        functions: project.files.reduce(
          (total, file) => total + file._count.functions,
          0,
        ),
      },
    })),
  );
});

router.get('/projects/:id', async (request, response) => {
  const id = Number(request.params.id);

  if (!Number.isSafeInteger(id)) {
    return response.status(400).json({ message: 'Invalid project id' });
  }

  const project = await prisma.codeProject.findUnique({
    where: { id },
    include: {
      categoryNode: true,
      files: {
        select: projectFileSummarySelect,
        orderBy: {
          projectPath: 'asc',
        },
      },
    },
  });

  if (!project) {
    return response.status(404).json({ message: 'Project not found' });
  }

  response.json({
    ...project,
    stats: {
      files: project.files.length,
      classes: project.files.reduce(
        (total, file) => total + file._count.classes,
        0,
      ),
      functions: project.files.reduce(
        (total, file) => total + file._count.functions,
        0,
      ),
    },
  });
});

router.get(
  '/projects/:projectId/files/:fileId',
  async (request, response) => {
    const projectId = Number(request.params.projectId);
    const fileId = Number(request.params.fileId);

    if (!Number.isSafeInteger(projectId) || !Number.isSafeInteger(fileId)) {
      return response.status(400).json({ message: 'Invalid id' });
    }

    const file = await prisma.codeFile.findFirst({
      where: {
        id: fileId,
        projectId,
      },
      include: projectFileInclude,
    });

    if (!file) {
      return response.status(404).json({ message: 'Project file not found' });
    }

    response.json(file);
  },
);

router.post(
  '/projects',
  protectAdminWrites,
  async (request, response) => {
    const { name, description, categoryId, files } = request.body;

    if (typeof name !== 'string' || !name.trim()) {
      return response.status(400).json({ message: '请输入项目名称' });
    }

    if (!(await isLeafCategory(categoryId))) {
      return response.status(400).json({
        message: '项目必须归到最底层子分类',
      });
    }

    if (!Array.isArray(files) || files.length === 0) {
      return response.status(400).json({ message: '没有读取到 lib 下的 Dart 文件' });
    }

    if (files.length > MAX_PROJECT_FILES) {
      return response.status(400).json({
        message: `项目最多导入 ${MAX_PROJECT_FILES} 个 Dart 文件`,
      });
    }

    const normalizedFiles: Array<{ path: string; code: string }> = [];
    let totalBytes = 0;

    for (const item of files) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof item.path !== 'string' ||
        typeof item.code !== 'string'
      ) {
        return response.status(400).json({ message: '项目文件格式不正确' });
      }

      const path = item.path.replaceAll('\\', '/').replace(/^\/+/, '');
      const libIndex = path.indexOf('lib/');
      const normalizedPath = libIndex >= 0 ? path.slice(libIndex) : path;

      if (!normalizedPath.startsWith('lib/') || !normalizedPath.endsWith('.dart')) {
        continue;
      }

      const bytes = Buffer.byteLength(item.code, 'utf8');

      if (bytes > MAX_FILE_BYTES) {
        return response.status(400).json({
          message: `${normalizedPath} 超过单文件 1 MB 限制`,
        });
      }

      totalBytes += bytes;
      normalizedFiles.push({
        path: normalizedPath,
        code: item.code,
      });
    }

    if (normalizedFiles.length === 0) {
      return response.status(400).json({ message: 'lib 下没有 Dart 文件' });
    }

    if (totalBytes > MAX_PROJECT_BYTES) {
      return response.status(400).json({
        message: 'lib 代码总量超过 15 MB 限制',
      });
    }

    const uniquePaths = new Set(normalizedFiles.map((file) => file.path));

    if (uniquePaths.size !== normalizedFiles.length) {
      return response.status(400).json({ message: '检测到重复文件路径' });
    }

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          const project = await tx.codeProject.create({
            data: {
              name: name.trim(),
              description:
                typeof description === 'string'
                  ? description.trim() || null
                  : null,
              language: 'dart',
              categoryId,
            },
          });

          for (const importedFile of normalizedFiles) {
            const fileName = importedFile.path.split('/').at(-1) ?? importedFile.path;
            const extraction = extractCodeUnits(importedFile.code);

            const file = await tx.codeFile.create({
              data: {
                name: fileName,
                language: 'dart',
                code: importedFile.code,
                description: `从项目 ${project.name} 导入`,
                projectId: project.id,
                projectPath: importedFile.path,
                categoryId,
              },
            });

            for (const extractedClass of extraction.classes) {
              const codeClass = await tx.codeClass.create({
                data: {
                  name: extractedClass.name,
                  language: 'dart',
                  code: extractedClass.code,
                  description: `从 ${project.name} / ${importedFile.path} 自动抽取`,
                  categoryId,
                  sourceFileId: file.id,
                },
              });

              for (const method of extractedClass.methods) {
                await tx.functionEntry.create({
                  data: {
                    name: method.name,
                    description:
                      `从 ${project.name} / ${importedFile.path} / ${extractedClass.name} 自动抽取`,
                    language: 'dart',
                    category: null,
                    categoryId,
                    sourceClassId: codeClass.id,
                    sourceFileId: file.id,
                    extracted: true,
                    variants: {
                      create: {
                        name: '项目 Class 方法',
                        language: 'dart',
                        code: method.code,
                        sourceName:
                          `${project.name} · ${importedFile.path} · ${extractedClass.name}`,
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
                  description: `从 ${project.name} / ${importedFile.path} 自动抽取`,
                  language: 'dart',
                  category: null,
                  categoryId,
                  sourceFileId: file.id,
                  extracted: true,
                  variants: {
                    create: {
                      name: '项目顶层函数',
                      language: 'dart',
                      code: topLevelFunction.code,
                      sourceName: `${project.name} · ${importedFile.path}`,
                    },
                  },
                },
              });
            }
          }

          return tx.codeProject.findUnique({
            where: { id: project.id },
            include: {
              categoryNode: true,
              files: {
                select: projectFileSummarySelect,
                orderBy: { projectPath: 'asc' },
              },
            },
          });
        },
        {
          maxWait: 10000,
          timeout: 120000,
        },
      );

      response.status(201).json(created);
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: '导入项目失败' });
    }
  },
);

router.delete(
  '/projects/:id',
  protectAdminWrites,
  async (request, response) => {
    const id = Number(request.params.id);

    if (!Number.isSafeInteger(id)) {
      return response.status(400).json({ message: 'Invalid project id' });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const projectFiles = await tx.codeFile.findMany({
          where: { projectId: id },
          select: { id: true },
        });
        const fileIds = projectFiles.map((file) => file.id);

        if (fileIds.length > 0) {
          await tx.functionEntry.deleteMany({
            where: {
              sourceFileId: { in: fileIds },
              extracted: true,
            },
          });
        }

        await tx.codeProject.delete({ where: { id } });
      });

      response.status(204).send();
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: '删除项目失败' });
    }
  },
);

export default router;
