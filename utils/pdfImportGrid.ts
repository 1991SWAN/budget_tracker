export interface PdfTextFragment {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface PdfTextPage {
  items: PdfTextFragment[];
}

interface PositionedFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  charWidth: number;
}

interface RowCellCandidate {
  text: string;
  x: number;
}

const DATE_LIKE_RE = /^(?:\d{2}\/\d{2}|\d{4}[./-]\d{1,2}[./-]\d{1,2})$/;
const AMOUNT_LIKE_RE = /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:원)?$/;
const HEADER_HINT_RE = /(일자|날짜|date|시간|가맹점|거래처|merchant|적요|내용|details|memo|금액|amount|청구|수수료|혜택|잔액|입금|출금|회차|기간|환율|포인트|이용)/i;

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

const normalizePdfText = (value: string): string => value.replace(/\s+/g, ' ').trim();
const NUMERIC_CELL_RE = /^-?\d+(?:,\d{3})*(?:\.\d+)?(?:원)?$/;

const joinCellText = (left: string, right: string, gap: number): string => {
  if (!left) return right;
  if (!right) return left;
  if (gap <= 1) return `${left}${right}`;
  if (/[(/-]$/.test(left) || /^[),.%/]/.test(right)) return `${left}${right}`;
  return `${left} ${right}`;
};

const shouldSplitAfterDateCell = (left: string, right: string, gap: number, mergeGap: number): boolean => {
  if (!DATE_LIKE_RE.test(left)) return false;
  if (gap <= Math.min(mergeGap * 0.45, 4)) return false;
  if (/^[\d,.\-]+$/.test(right)) return false;
  return true;
};

const isNumericCell = (value: string): boolean => NUMERIC_CELL_RE.test(value.trim());

const shouldSplitBeforeNumericCell = (left: string, right: string, gap: number, mergeGap: number): boolean => {
  if (!isNumericCell(right)) return false;
  if (gap <= Math.min(mergeGap * 0.4, 6)) return false;

  const normalizedLeft = left.trim();
  if (!normalizedLeft) return false;
  if (DATE_LIKE_RE.test(normalizedLeft)) return true;
  if (isNumericCell(normalizedLeft)) return true;

  const lastChar = normalizedLeft[normalizedLeft.length - 1] || '';
  return /[A-Za-z0-9가-힣)]/.test(lastChar);
};

const toPositionedFragments = (page: PdfTextPage): PositionedFragment[] => page.items
  .map((item): PositionedFragment | null => {
    const text = normalizePdfText(item.str || '');
    const transform = item.transform;
    if (!text || !Array.isArray(transform) || transform.length < 6) return null;

    const x = Number(transform[4]);
    const y = Number(transform[5]);
    const width = Math.abs(Number(item.width ?? 0));
    const heightFromTransform = Math.abs(Number(transform[3] ?? 0));
    const rawHeight = item.height ?? heightFromTransform ?? 0;
    const height = Math.abs(Number(rawHeight));
    const charWidth = text.length > 0 && width > 0 ? width / text.length : 0;

    return {
      text,
      x,
      y,
      width,
      height,
      charWidth,
    };
  })
  .filter((item): item is PositionedFragment => Boolean(item))
  .sort((left, right) => {
    const yDiff = right.y - left.y;
    if (Math.abs(yDiff) > 0.5) return yDiff;
    return left.x - right.x;
  });

const mergeRowFragments = (
  fragments: PositionedFragment[],
  mergeGap: number,
): RowCellCandidate[] => {
  if (fragments.length === 0) return [];

  const sorted = [...fragments].sort((left, right) => left.x - right.x);
  const cells: Array<RowCellCandidate & { rightEdge: number }> = [];

  sorted.forEach((fragment) => {
    const lastCell = cells[cells.length - 1];
    const fragmentRightEdge = fragment.x + Math.max(fragment.width, fragment.charWidth * fragment.text.length);

    if (!lastCell) {
      cells.push({
        text: fragment.text,
        x: fragment.x,
        rightEdge: fragmentRightEdge,
      });
      return;
    }

    const gap = fragment.x - lastCell.rightEdge;
    if (shouldSplitAfterDateCell(lastCell.text, fragment.text, gap, mergeGap)) {
      cells.push({
        text: fragment.text,
        x: fragment.x,
        rightEdge: fragmentRightEdge,
      });
      return;
    }

    if (shouldSplitBeforeNumericCell(lastCell.text, fragment.text, gap, mergeGap)) {
      cells.push({
        text: fragment.text,
        x: fragment.x,
        rightEdge: fragmentRightEdge,
      });
      return;
    }

    if (gap <= mergeGap) {
      lastCell.text = joinCellText(lastCell.text, fragment.text, gap);
      lastCell.rightEdge = Math.max(lastCell.rightEdge, fragmentRightEdge);
      return;
    }

    cells.push({
      text: fragment.text,
      x: fragment.x,
      rightEdge: fragmentRightEdge,
    });
  });

  return cells.map(({ text, x }) => ({ text, x }));
};

const groupPageRows = (fragments: PositionedFragment[]): RowCellCandidate[][] => {
  if (fragments.length === 0) return [];

  const fragmentHeights = fragments
    .map(fragment => fragment.height)
    .filter(height => Number.isFinite(height) && height > 0);
  const charWidths = fragments
    .map(fragment => fragment.charWidth)
    .filter(width => Number.isFinite(width) && width > 0);

  const rowTolerance = clamp(median(fragmentHeights) * 0.75 || 5, 4, 14);
  const mergeGap = clamp(median(charWidths) * 2.5 || 8, 4, 20);

  const rows: Array<{ y: number; fragments: PositionedFragment[] }> = [];
  fragments.forEach((fragment) => {
    let matchingRow: { y: number; fragments: PositionedFragment[] } | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    rows.forEach((candidate) => {
      const distance = Math.abs(candidate.y - fragment.y);
      if (distance <= rowTolerance && distance < closestDistance) {
        matchingRow = candidate;
        closestDistance = distance;
      }
    });

    if (!matchingRow) {
      rows.push({ y: fragment.y, fragments: [fragment] });
      return;
    }

    matchingRow.fragments.push(fragment);
    matchingRow.y = (matchingRow.y * (matchingRow.fragments.length - 1) + fragment.y) / matchingRow.fragments.length;
  });

  return rows
    .sort((left, right) => right.y - left.y)
    .map(row => mergeRowFragments(row.fragments, mergeGap))
    .filter(row => row.length > 0);
};

const buildColumnClusters = (rows: RowCellCandidate[][]): number[] => {
  const xPositions = rows
    .flat()
    .map(cell => cell.x)
    .filter(value => Number.isFinite(value))
    .sort((left, right) => left - right);

  if (xPositions.length === 0) return [];

  const gaps = xPositions
    .slice(1)
    .map((value, index) => value - xPositions[index])
    .filter(gap => gap > 0);
  const columnTolerance = clamp(median(gaps) * 0.2 || 18, 10, 36);

  const clusters: Array<{ center: number; count: number }> = [];
  xPositions.forEach((x) => {
    const existing = clusters.find(cluster => Math.abs(cluster.center - x) <= columnTolerance);
    if (!existing) {
      clusters.push({ center: x, count: 1 });
      return;
    }

    existing.center = ((existing.center * existing.count) + x) / (existing.count + 1);
    existing.count += 1;
  });

  return clusters
    .sort((left, right) => left.center - right.center)
    .map(cluster => cluster.center);
};

const getDateColumnIndex = (grid: string[][]): number => {
  const counts = new Map<number, number>();

  grid.forEach((row) => {
    row.forEach((cell, index) => {
      if (DATE_LIKE_RE.test((cell || '').trim())) {
        counts.set(index, (counts.get(index) || 0) + 1);
      }
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? -1;
};

const isZeroAmount = (value: string): boolean => /^(?:0|0원|0\.0+)$/.test(value.trim());

const hasTransactionAmount = (row: string[], dateColumnIndex: number): boolean => (
  row.some((cell, index) => {
    if (index === dateColumnIndex) return false;
    const value = (cell || '').trim();
    return AMOUNT_LIKE_RE.test(value) && !isZeroAmount(value);
  })
);

const getAmountColumnIndex = (grid: string[][], dateColumnIndex: number): number => {
  const counts = new Map<number, number>();

  grid.forEach((row) => {
    const hasDate = dateColumnIndex >= 0 && DATE_LIKE_RE.test((row[dateColumnIndex] || '').trim());
    if (!hasDate) return;

    row.forEach((cell, index) => {
      if (index === dateColumnIndex) return;
      if (AMOUNT_LIKE_RE.test((cell || '').trim())) {
        counts.set(index, (counts.get(index) || 0) + 1);
      }
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? -1;
};

const getMerchantColumnIndex = (grid: string[][], dateColumnIndex: number, amountColumnIndex: number): number => {
  const counts = new Map<number, number>();

  grid.forEach((row) => {
    const hasDate = dateColumnIndex >= 0 && DATE_LIKE_RE.test((row[dateColumnIndex] || '').trim());
    const hasAmount = amountColumnIndex >= 0 && AMOUNT_LIKE_RE.test((row[amountColumnIndex] || '').trim());
    if (!hasDate || !hasAmount) return;

    row.forEach((cell, index) => {
      const value = (cell || '').trim();
      if (!value || index === dateColumnIndex || index === amountColumnIndex) return;
      if (DATE_LIKE_RE.test(value) || AMOUNT_LIKE_RE.test(value)) return;
      counts.set(index, (counts.get(index) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? -1;
};

const mergeContinuationRows = (grid: string[][]): string[][] => {
  const dateColumnIndex = getDateColumnIndex(grid);
  const amountColumnIndex = getAmountColumnIndex(grid, dateColumnIndex);
  const merchantColumnIndex = getMerchantColumnIndex(grid, dateColumnIndex, amountColumnIndex);

  if (dateColumnIndex < 0 || amountColumnIndex < 0 || merchantColumnIndex < 0) {
    return grid;
  }

  const isTransactionRow = (row: string[]): boolean => {
    if (!DATE_LIKE_RE.test((row[dateColumnIndex] || '').trim())) return false;
    return hasTransactionAmount(row, dateColumnIndex);
  };

  const mergedRows: string[][] = [];
  grid.forEach((row) => {
    const nonEmptyCells = row
      .map((cell, index) => ({ cell: (cell || '').trim(), index }))
      .filter(entry => entry.cell !== '');

    const isContinuationRow = (
      nonEmptyCells.length === 1 &&
      nonEmptyCells[0].index === merchantColumnIndex &&
      !isTransactionRow(row)
    );

    if (isContinuationRow && mergedRows.length > 0) {
      const previousRow = mergedRows[mergedRows.length - 1];
      if (isTransactionRow(previousRow)) {
        previousRow[merchantColumnIndex] = previousRow[merchantColumnIndex]
          ? `${previousRow[merchantColumnIndex]} ${nonEmptyCells[0].cell}`
          : nonEmptyCells[0].cell;
        return;
      }
    }

    mergedRows.push([...row]);
  });

  return mergedRows;
};

const buildSyntheticHeaderRow = (rows: string[][], columnCount: number): string[] => (
  Array.from({ length: columnCount }, (_, columnIndex) => {
    const values = rows
      .map(row => (row[columnIndex] || '').trim())
      .filter(Boolean)
      .filter((value, index, list) => list.indexOf(value) === index);
    return values.join(' ').trim();
  })
);

const findBestHeaderValue = (rows: string[][], pattern: RegExp): string => {
  const values = rows
    .flatMap(row => row.map(cell => (cell || '').trim()))
    .filter(Boolean)
    .filter(value => pattern.test(value));

  return values[0] || '';
};

const findNearestHeaderValue = (
  headerRow: string[],
  columnIndex: number,
  pattern?: RegExp,
): string => {
  const exact = (headerRow[columnIndex] || '').trim();
  if (exact && (!pattern || pattern.test(exact))) return exact;

  for (let offset = 1; offset <= 3; offset += 1) {
    const candidates = [columnIndex - offset, columnIndex + offset]
      .filter(index => index >= 0 && index < headerRow.length)
      .map(index => (headerRow[index] || '').trim())
      .filter(Boolean);

    const matched = pattern ? candidates.find(value => pattern.test(value)) : candidates[0];
    if (matched) return matched;
  }

  return '';
};

const parseNumericCell = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeProjectedHeaderLabel = (value: string): string => {
  const normalized = normalizePdfText(value);
  if (!normalized) return '';
  if (/(일자|날짜|date)/i.test(normalized)) return '이용 일자';
  if (/(가맹점|거래처|merchant|details|memo)/i.test(normalized)) return '이용가맹점';
  if (/(이용.?금액|금액 액\))/i.test(normalized)) return '이용금액';
  if (/납부.*금액/i.test(normalized)) return '납부하실 금액';
  if (/결제\s*후\s*잔액/i.test(normalized)) return '결제 후 잔액';
  if (/혜택\s*금액/i.test(normalized)) return '혜택 금액';
  if (/(이용\s*혜택|혜택)/i.test(normalized)) return '이용 혜택';
  if (/(수수료|환율)/i.test(normalized)) return '수수료';
  if (/(청구.*금액|\(US\$\)|US\$)/i.test(normalized)) return '청구금액';
  if (/기간/.test(normalized) && !/회차/.test(normalized)) return '기간';
  if (/회차/.test(normalized) && !/기간/.test(normalized)) return '회차';
  return normalized;
};

const refineProjectedHeader = (
  header: string[],
  rows: string[][],
  dateColumnIndex: number,
  merchantColumnIndex: number,
): string[] => {
  const next = header.map(normalizeProjectedHeaderLabel);
  if (rows.length === 0 || next.length < 6) return next;

  if (dateColumnIndex >= 0) next[dateColumnIndex] = '이용 일자';
  if (merchantColumnIndex >= 0) next[merchantColumnIndex] = '이용가맹점';

  const stats = next.map((_, columnIndex) => {
    const values = rows
      .map(row => (row[columnIndex] || '').trim())
      .filter(Boolean);
    const numericValues = values
      .map(parseNumericCell)
      .filter((value): value is number => value !== null);
    const amountLikeCount = values.filter(isNumericCell).length;
    const textLikeCount = values.length - amountLikeCount;
    const shortIntegerCount = numericValues.filter(value => Number.isInteger(value) && Math.abs(value) <= 60).length;
    const maxAbs = numericValues.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

    return {
      valuesCount: values.length,
      amountLikeRatio: values.length > 0 ? amountLikeCount / values.length : 0,
      textLikeRatio: values.length > 0 ? textLikeCount / values.length : 0,
      shortIntegerRatio: values.length > 0 ? shortIntegerCount / values.length : 0,
      maxAbs,
    };
  });

  const candidateIndexes = next
    .map((_, index) => index)
    .filter(index => index !== dateColumnIndex && index !== merchantColumnIndex && stats[index].valuesCount > 0);

  const primaryAmountIndex = candidateIndexes.find(index => stats[index].amountLikeRatio >= 0.6) ?? -1;
  if (primaryAmountIndex >= 0) next[primaryAmountIndex] = '이용금액';

  const shortIntegerIndexes = candidateIndexes.filter(index => (
    index > primaryAmountIndex &&
    stats[index].shortIntegerRatio >= 0.6 &&
    stats[index].maxAbs <= 60
  ));

  if (shortIntegerIndexes[0] !== undefined) next[shortIntegerIndexes[0]] = '기간';
  if (shortIntegerIndexes[1] !== undefined) next[shortIntegerIndexes[1]] = '회차';

  const benefitLabelIndex = candidateIndexes.find(index => (
    index > primaryAmountIndex &&
    stats[index].textLikeRatio >= 0.3 &&
    next[index] !== '이용가맹점'
  )) ?? -1;

  if (benefitLabelIndex >= 0) next[benefitLabelIndex] = '이용 혜택';

  const feeIndex = candidateIndexes.find(index => (
    index > primaryAmountIndex &&
    !shortIntegerIndexes.includes(index) &&
    (next[index] === '수수료' || (
      stats[index].amountLikeRatio >= 0.6 &&
      stats[index].shortIntegerRatio >= 0.6 &&
      stats[index].maxAbs <= 1000
    ))
  )) ?? -1;

  if (feeIndex >= 0) next[feeIndex] = '수수료';

  const amountIndexes = candidateIndexes.filter(index => (
    index !== primaryAmountIndex &&
    index !== feeIndex &&
    !shortIntegerIndexes.includes(index) &&
    stats[index].amountLikeRatio >= 0.6
  ));

  const balanceIndex = amountIndexes[amountIndexes.length - 1] ?? -1;
  if (balanceIndex >= 0) next[balanceIndex] = '결제 후 잔액';

  const payableIndex = amountIndexes.filter(index => index !== balanceIndex).at(-1) ?? -1;
  if (payableIndex >= 0) next[payableIndex] = '납부하실 금액';

  const benefitAmountIndex = benefitLabelIndex >= 0
    ? amountIndexes.find(index => index > benefitLabelIndex && index !== payableIndex && index !== balanceIndex) ?? -1
    : -1;

  if (benefitAmountIndex >= 0) next[benefitAmountIndex] = '혜택 금액';

  const chargeIndex = amountIndexes.find(index => (
    index !== benefitAmountIndex &&
    index !== payableIndex &&
    index !== balanceIndex
  )) ?? -1;

  if (chargeIndex >= 0) next[chargeIndex] = '청구금액';

  return next;
};

const getDominantMerchantDataColumnIndex = (rows: string[][], dateColumnIndex: number): number => {
  const scores = new Map<number, number>();

  rows.forEach((row) => {
    row.forEach((cell, index) => {
      if (index === dateColumnIndex) return;
      const value = (cell || '').trim();
      if (!value) return;
      if (DATE_LIKE_RE.test(value) || AMOUNT_LIKE_RE.test(value)) return;
      scores.set(index, (scores.get(index) || 0) + 1);
    });
  });

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? -1;
};

const isLikelyHeaderRow = (row: string[]): boolean => {
  const nonEmptyValues = row.map(cell => (cell || '').trim()).filter(Boolean);
  if (nonEmptyValues.length === 0) return false;
  if (nonEmptyValues.length >= 2) return true;
  return nonEmptyValues.some(value => HEADER_HINT_RE.test(value));
};

const extractLikelyTransactionTable = (grid: string[][]): string[][] => {
  const dateColumnIndex = getDateColumnIndex(grid);
  if (dateColumnIndex < 0) return grid;

  const transactionRows = grid.filter(row => (
    DATE_LIKE_RE.test((row[dateColumnIndex] || '').trim()) &&
    hasTransactionAmount(row, dateColumnIndex)
  ));

  if (transactionRows.length < 5) return grid;

  const transactionStartIndex = grid.findIndex(row => (
    DATE_LIKE_RE.test((row[dateColumnIndex] || '').trim()) &&
    hasTransactionAmount(row, dateColumnIndex)
  ));

  if (transactionStartIndex < 0) return grid;

  const headerLookbackRows = grid
    .slice(Math.max(0, transactionStartIndex - 6), transactionStartIndex)
    .filter(isLikelyHeaderRow);

  const columnCount = Math.max(...grid.map(row => row.length));
  const syntheticHeader = headerLookbackRows.length > 0
    ? buildSyntheticHeaderRow(headerLookbackRows, columnCount)
    : Array.from({ length: columnCount }, () => '');

  const dataColumnIndexes = Array.from({ length: columnCount }, (_, index) => index)
    .filter((index) => {
      const values = transactionRows
        .map(row => (row[index] || '').trim())
        .filter(Boolean);

      if (values.length === 0) return false;
      if (values.some(value => !AMOUNT_LIKE_RE.test(value))) return true;
      return values.some(value => !isZeroAmount(value));
    });

  const merchantColumnIndex = getDominantMerchantDataColumnIndex(transactionRows, dateColumnIndex);
  const amountColumnIndexes = dataColumnIndexes.filter(index => (
    index !== dateColumnIndex &&
    transactionRows.some(row => {
      const value = (row[index] || '').trim();
      return AMOUNT_LIKE_RE.test(value) && !isZeroAmount(value);
    })
  ));

  const projectedHeader = dataColumnIndexes.map((index) => {
    if (!syntheticHeader.some(Boolean)) return '';

    if (index === dateColumnIndex) {
      return findNearestHeaderValue(syntheticHeader, index, /(일자|날짜|date|시간)/i) ||
        findBestHeaderValue(headerLookbackRows, /(일자|날짜|date|시간)/i) ||
        'Date';
    }

    if (index === merchantColumnIndex) {
      return findNearestHeaderValue(syntheticHeader, index, /(가맹점|거래처|merchant|적요|내용|details|memo)/i) ||
        findBestHeaderValue(headerLookbackRows, /(가맹점|거래처|merchant|적요|내용|details|memo)/i) ||
        'Details';
    }

    if (amountColumnIndexes.includes(index)) {
      return findNearestHeaderValue(syntheticHeader, index, /(금액|amount|청구|수수료|환율|us\$|혜택|잔액|포인트)/i) ||
        findBestHeaderValue(headerLookbackRows, /(금액|amount|청구|수수료|환율|us\$|혜택|잔액|포인트)/i) ||
        'Amount';
    }

    return findNearestHeaderValue(syntheticHeader, index, HEADER_HINT_RE);
  });

  const compactTransactionRows = transactionRows.map(row => dataColumnIndexes.map(index => row[index] || ''));
  const compactDateColumnIndex = dataColumnIndexes.indexOf(dateColumnIndex);
  const compactMerchantColumnIndex = dataColumnIndexes.indexOf(merchantColumnIndex);
  const refinedHeader = refineProjectedHeader(
    projectedHeader,
    compactTransactionRows,
    compactDateColumnIndex,
    compactMerchantColumnIndex,
  );

  return refinedHeader.length > 0
    ? [refinedHeader, ...compactTransactionRows]
    : compactTransactionRows;
};

export const buildPdfImportGrid = (pages: PdfTextPage[]): string[][] => {
  const pageRows = pages.flatMap(page => groupPageRows(toPositionedFragments(page)));
  if (pageRows.length === 0) return [];

  const columnCenters = buildColumnClusters(pageRows);
  if (columnCenters.length === 0) return [];

  const grid = pageRows.map((rowCells) => {
    const row = Array.from({ length: columnCenters.length }, () => '');

    rowCells.forEach((cell) => {
      let targetIndex = 0;
      let minDistance = Number.POSITIVE_INFINITY;

      columnCenters.forEach((center, index) => {
        const distance = Math.abs(center - cell.x);
        if (distance < minDistance) {
          minDistance = distance;
          targetIndex = index;
        }
      });

      row[targetIndex] = row[targetIndex]
        ? `${row[targetIndex]} ${cell.text}`
        : cell.text;
    });

    return row;
  });

  const usedColumnIndexes = columnCenters
    .map((_, index) => index)
    .filter(index => grid.some(row => normalizePdfText(row[index] || '') !== ''));

  const compactGrid = grid.map(row => usedColumnIndexes.map(index => row[index] || ''));
  const mergedGrid = mergeContinuationRows(compactGrid);
  return extractLikelyTransactionTable(mergedGrid);
};
