export type ExtractedFunction = {
  name: string;
  code: string;
};

export type ExtractedClass = {
  name: string;
  code: string;
  methods: ExtractedFunction[];
};

export type CodeExtractionResult = {
  classes: ExtractedClass[];
  topLevelFunctions: ExtractedFunction[];
};

const CONTROL_NAMES = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'try',
  'else',
  'do',
  'finally',
  'with',
]);

function maskCommentsAndStrings(code: string): string {
  const chars = [...code];
  const result = [...code];
  let index = 0;

  while (index < chars.length) {
    const char = chars[index];
    const next = chars[index + 1];

    if (char === '/' && next === '/') {
      result[index] = ' ';
      result[index + 1] = ' ';
      index += 2;

      while (index < chars.length && chars[index] !== '\n') {
        result[index] = ' ';
        index += 1;
      }

      continue;
    }

    if (char === '/' && next === '*') {
      result[index] = ' ';
      result[index + 1] = ' ';
      index += 2;

      while (index < chars.length) {
        if (chars[index] === '*' && chars[index + 1] === '/') {
          result[index] = ' ';
          result[index + 1] = ' ';
          index += 2;
          break;
        }

        if (chars[index] !== '\n') {
          result[index] = ' ';
        }
        index += 1;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      index += 1;
      let escaped = false;

      while (index < chars.length) {
        const current = chars[index];

        if (current === '\n' && quote !== '`') {
          break;
        }

        if (current !== '\n') {
          result[index] = ' ';
        }

        if (escaped) {
          escaped = false;
          index += 1;
          continue;
        }

        if (current === '\\') {
          escaped = true;
          index += 1;
          continue;
        }

        if (current === quote) {
          break;
        }

        index += 1;
      }

      index += 1;
      continue;
    }

    index += 1;
  }

  return result.join('');
}

function findMatchingBrace(
  maskedCode: string,
  openIndex: number,
): number {
  let depth = 0;

  for (let index = openIndex; index < maskedCode.length; index += 1) {
    const char = maskedCode[index];

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function getDepths(maskedCode: string): number[] {
  const depths = new Array<number>(maskedCode.length).fill(0);
  let depth = 0;

  for (let index = 0; index < maskedCode.length; index += 1) {
    depths[index] = depth;

    if (maskedCode[index] === '{') {
      depth += 1;
    } else if (maskedCode[index] === '}') {
      depth = Math.max(0, depth - 1);
    }
  }

  return depths;
}

function findUnitStart(
  maskedCode: string,
  depths: number[],
  index: number,
  baseDepth: number,
  lowerBound: number,
): number {
  for (let cursor = index - 1; cursor >= lowerBound; cursor -= 1) {
    if (depths[cursor] !== baseDepth) {
      continue;
    }

    const char = maskedCode[cursor];

    if (char === ';' || char === '{' || char === '}') {
      return cursor + 1;
    }
  }

  return lowerBound;
}

function callableName(header: string): string | null {
  const cleaned = header
    .replace(/@[A-Za-z_$][\w$]*(?:\([^\n]*\))?\s*/g, ' ')
    .trim();

  const matches = [
    ...cleaned.matchAll(
      /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\(/g,
    ),
  ];

  if (matches.length === 0) {
    return null;
  }

  // Usually the last call-shaped identifier in a declaration is the method
  // name. For constructor initializer lists (`Foo() : super()`) use the first
  // identifier instead so `super` is not mistaken for the constructor.
  const colonIndex = cleaned.indexOf(':');
  const candidates = colonIndex >= 0
    ? matches.filter((match) => (match.index ?? 0) < colonIndex)
    : matches;
  const selected = candidates.at(-1) ?? matches[0];
  const name = selected?.[1] ?? '';
  const simpleName = name.split('.').at(-1) ?? name;

  if (!simpleName || CONTROL_NAMES.has(simpleName)) {
    return null;
  }

  return name;
}

function extractBlockFunctions(
  code: string,
  maskedCode: string,
  lowerBound: number,
  upperBound: number,
  baseDepth: number,
): ExtractedFunction[] {
  const depths = getDepths(maskedCode);
  const results: ExtractedFunction[] = [];
  const seen = new Set<string>();

  for (let index = lowerBound; index < upperBound; index += 1) {
    if (maskedCode[index] !== '{' || depths[index] !== baseDepth) {
      continue;
    }

    const start = findUnitStart(
      maskedCode,
      depths,
      index,
      baseDepth,
      lowerBound,
    );
    const header = code.slice(start, index).trim();
    const name = callableName(header);

    if (!name) {
      continue;
    }

    const end = findMatchingBrace(maskedCode, index);

    if (end < 0 || end > upperBound) {
      continue;
    }

    const raw = code.slice(start, end + 1).trim();

    if (!raw || seen.has(`${name}\u0000${raw}`)) {
      continue;
    }

    seen.add(`${name}\u0000${raw}`);
    results.push({
      name,
      code: raw,
    });
  }

  // Expression-bodied methods/functions (`foo() => value;`).
  const arrowPattern = /=>/g;
  let match: RegExpExecArray | null;

  while ((match = arrowPattern.exec(maskedCode)) !== null) {
    const arrowIndex = match.index;

    if (
      arrowIndex < lowerBound ||
      arrowIndex >= upperBound ||
      depths[arrowIndex] !== baseDepth
    ) {
      continue;
    }

    const start = findUnitStart(
      maskedCode,
      depths,
      arrowIndex,
      baseDepth,
      lowerBound,
    );
    const header = code.slice(start, arrowIndex).trim();
    const name = callableName(header);

    if (!name) {
      continue;
    }

    let end = arrowIndex + 2;

    while (end < upperBound) {
      if (maskedCode[end] === ';' && depths[end] === baseDepth) {
        break;
      }
      end += 1;
    }

    if (end >= upperBound) {
      continue;
    }

    const raw = code.slice(start, end + 1).trim();

    if (!raw || seen.has(`${name}\u0000${raw}`)) {
      continue;
    }

    seen.add(`${name}\u0000${raw}`);
    results.push({
      name,
      code: raw,
    });
  }

  return results.sort(
    (left, right) => code.indexOf(left.code) - code.indexOf(right.code),
  );
}

export function extractCodeUnits(code: string): CodeExtractionResult {
  const maskedCode = maskCommentsAndStrings(code);
  const classPattern = /\b(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)[^;{]*\{/g;
  const classes: ExtractedClass[] = [];
  const classRanges: Array<[number, number]> = [];
  let classMatch: RegExpExecArray | null;

  while ((classMatch = classPattern.exec(maskedCode)) !== null) {
    const className = classMatch[1];
    const openOffset = classMatch[0].lastIndexOf('{');
    const openIndex = classMatch.index + openOffset;
    const closeIndex = findMatchingBrace(maskedCode, openIndex);

    if (closeIndex < 0) {
      continue;
    }

    const classStart = classMatch.index;
    const classCode = code.slice(classStart, closeIndex + 1).trim();
    const methods = extractBlockFunctions(
      code,
      maskedCode,
      openIndex + 1,
      closeIndex,
      1,
    );

    classes.push({
      name: className,
      code: classCode,
      methods,
    });
    classRanges.push([classStart, closeIndex + 1]);
    classPattern.lastIndex = closeIndex + 1;
  }

  const topLevelMaskChars = [...maskedCode];

  for (const [start, end] of classRanges) {
    for (let index = start; index < end; index += 1) {
      if (topLevelMaskChars[index] !== '\n') {
        topLevelMaskChars[index] = ' ';
      }
    }
  }

  const topLevelMasked = topLevelMaskChars.join('');
  const topLevelFunctions = extractBlockFunctions(
    code,
    topLevelMasked,
    0,
    code.length,
    0,
  );

  return {
    classes,
    topLevelFunctions,
  };
}

export function extractSingleClass(code: string): ExtractedClass | null {
  return extractCodeUnits(code).classes[0] ?? null;
}
