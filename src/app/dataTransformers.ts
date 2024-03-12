import {
  ArrayHeaderType,
  IBodyData,
  ICell,
  IChanges,
  IHeaderCell,
  IHeaderData,
  IHeaderRowData,
  IOptionsData,
  ISortedBodyRow,
  ITableCellOption,
  SavedTableType,
  TableDataList,
  TemplateDataType,
} from '../types';

const random_h = 16;
const random_s = 1000;
export const ObjectId = (
  m = Math,
  d = Date,
  h = random_h,
  s = (s: number) => m.floor(s).toString(h),
) =>
  s(d.now() / random_s) + ' '.repeat(h).replace(/./g, () => s(m.random() * h));

export const dataSorter = (data: IBodyData): ISortedBodyRow[] => {
  const sortedData = [];
  Object.entries(data).forEach(([rowId, row]: any) => {
    sortedData[row.rowIndex] = { rowId };
    Object.entries(row).forEach(([keyC, col]: any) => {
      if (keyC === 'rowIndex') {
        return;
      }
      sortedData[row.rowIndex][keyC] = { ...col, rowId };
    });
  });

  return sortedData;
};

export const dataSorterArray = (
  data: IBodyData | TemplateDataType,
  columnsList: string[],
): TableDataList => {
  if (!columnsList) return [];
  const sortedData: TableDataList = [];

  if (!data) {
    console.log('No data error');
    return;
  }
  Object.entries(data).forEach(([rowId, row]: any) => {
    let index = row.rowIndex;
    if (index === undefined) index = sortedData.length;
    sortedData[index] = { rowId, data: {} };
    columnsList.forEach((key) => {
      if (key === 'rowIndex') {
        return;
      }
      sortedData[index].data[key] =
        typeof row[key] === 'string'
          ? { value: row[key] }
          : row[key] || { value: '' };
      //sortedData[row.rowIndex].data.push({ ...row[key], colId: key });
    });
  });

  return sortedData.filter((t) => t);
};

export const prepareDataToSave = (data: IBodyData): SavedTableType => {
  const newData: SavedTableType = [];
  Object.entries(data).forEach(([rowId, row]: any) => {
    newData[row.rowIndex] = { _id: rowId };
    Object.entries(row).forEach(([keyC, col]: any) => {
      if (keyC === 'rowIndex') {
        return;
      }
      newData[row.rowIndex][keyC] = col;
    });
  });

  return newData;
};

export const convertLoadedData = (
  data: SavedTableType,
  options: IOptionsData,
): IBodyData => {
  const cols = options.columnsList || Object.keys(options.cols);
  const newData: IBodyData = {};
  data.forEach((row, i) => {
    const key = row._id;
    newData[key] = {};
    newData[key].rowIndex = i;
    cols.forEach((colKey) => {
      if (!row[colKey]) {
        newData[key][colKey] = { value: '', colId: colKey } as ICell;
      } else {
        if (typeof row[colKey] === 'object') {
          newData[key][colKey] = row[colKey] as ICell;
        } else {
          newData[key][colKey] = { value: row[colKey] } as ICell;
        }
      }
    });
  });

  return newData;
};

export const dataTransform = <T extends object>(
  data: T,
  tableData: IBodyData,
): T => {
  const newData = {} as T;
  Object.entries(data).forEach(([keyR, row]) => {
    if (!tableData[keyR]) {
      return;
    }
    const rowIndex = tableData[keyR].rowIndex;
    Object.entries(row).forEach(
      ([keyC, col]: [string, { rowIndex: string }]) => {
        if (rowIndex in newData) {
          newData[rowIndex] = {
            ...newData[rowIndex],
            [keyC]: { ...col, rowId: keyR },
          };
        } else {
          newData[rowIndex] = { [keyC]: { ...col, rowId: keyR } };
        }
      },
    );
  });

  return newData;
};
export const blocksTransform = (data, tableData?: IBodyData) => {
  const newData = {};
  if (!data) return newData;

  Object.entries(data).forEach(([, user]) => {
    Object.entries(user).forEach(([rowKey, row]) => {
      const rowIndex = tableData ? tableData[rowKey]?.rowIndex : undefined;
      Object.entries(row).forEach(([keyC, col]: any[]) => {
        const index: number = rowIndex !== undefined ? rowIndex : col.rowIndex;
        if (index in newData) {
          newData[index] = [...newData[index], keyC];
        } else {
          newData[index] = [keyC];
        }
      });
    });
  });
  return newData;
};

export const addRow = (data: IBodyData, rowId: string, before: boolean) => {
  if (!data[rowId]) return data;
  let rowIndex = data[rowId].rowIndex;
  if (rowIndex === undefined) return data;
  if (!before) rowIndex++;
  Object.entries(data).forEach(([rowId1, row]: any) => {
    if (row.rowIndex !== undefined && row.rowIndex >= rowIndex) {
      const t = data[rowId1];
      t.rowIndex += 1;
    }
  });
  const n = Object.keys(data).length;
  const cols = Object.keys(data[rowId]);
  const newId = 'row_' + n + ObjectId();
  data[newId] = {};
  cols.forEach((col) => {
    data[newId][col] = { value: '' };
  });
  data[newId].rowIndex = rowIndex;
  return data;
};
export const addHeadRowFn = (
  columnList: string[],
  data: IHeaderData,
  newRowData: IHeaderCell[],
  rowId: string,
  before: boolean,
): IHeaderData => {
  if (!data[rowId]) return data;
  let rowIndex = data[rowId].rowIndex;
  if (rowIndex === undefined) return data;
  if (!before) rowIndex++;
  Object.entries(data).forEach(([keyR, row]: any) => {
    if (row.rowIndex !== undefined && row.rowIndex >= rowIndex) {
      const t = data[keyR];
      t.rowIndex += 1;
    }
  });
  const n = Object.keys(data).length;

  const newId = 'rowh_' + n + ObjectId();
  data[newId] = {};
  let currentColIndex = 0;
  for (const cell of newRowData) {
    data[newId][columnList[currentColIndex]] = cell;
    currentColIndex += cell.colSpan;
  }
  data[newId].rowIndex = rowIndex;
  return data;
};
export const editHeadRowFn = (
  columnList: string[],
  data: IHeaderData,
  newRowData: IHeaderCell[],
  rowId: string,
): IHeaderData => {
  const newRow = { rowIndex: data[rowId].rowIndex } as IHeaderRowData;
  let currentColIndex = 0;
  for (const cell of newRowData) {
    newRow[columnList[currentColIndex]] = cell;
    currentColIndex += cell.colSpan;
  }
  data[rowId] = newRow;
  return data;
};

export const deleteRow = (data: IBodyData, rowId: string) => {
  if (!data[rowId]) return data;
  const rowIndex = data[rowId].rowIndex;
  if (rowIndex === undefined) return data;
  Object.entries(data).forEach(([rowId, row]: any) => {
    if (row.rowIndex !== undefined && row.rowIndex >= rowIndex) {
      const t = data[rowId];
      t.rowIndex -= 1;
    }
  });
  delete data[rowId];
  return data;
};

export const deleteHeadRowFn = (data: IHeaderData, rowId: string) => {
  if (!data[rowId]) return data;
  const rowIndex = data[rowId].rowIndex;
  if (rowIndex === undefined) return data;
  Object.entries(data).forEach(([rowId, row]: any) => {
    if (row.rowIndex !== undefined && row.rowIndex >= rowIndex) {
      const t = data[rowId];
      t.rowIndex -= 1;
    }
  });
  delete data[rowId];
  return data;
};
export const mergeOptionChanges = (
  options: IOptionsData,
  colOptions: ITableCellOption,
  colId: string,
) => {
  const filteredColOtions = {} as ITableCellOption;

  Object.keys(colOptions).forEach((key) => {
    if (colOptions[key] !== undefined)
      switch (key) {
        case 'editable':
        case 'blocked':
        case 'frozen':
        case 'width':
        case 'type':
        case 'summary':
        case 'rowspan':
          filteredColOtions[key] = colOptions[key];
      }
  });
  switch (colOptions.type) {
    case 'amselect':
    case 'aselect':
      filteredColOtions.asyncTargetOptions = colOptions.asyncTargetOptions;
      filteredColOtions.selectOptionsPath = colOptions.selectOptionsPath;
      filteredColOtions.selectPlaceholder = colOptions.selectPlaceholder;
      break;
    case 'mselect':
    case 'select':
      filteredColOtions.selectOptions = colOptions.selectOptions;
      filteredColOtions.selectPlaceholder = colOptions.selectPlaceholder;
      break;
    case 'upload':
      filteredColOtions.formats = colOptions.formats;
      filteredColOtions.maxSize = colOptions.maxSize;
      break;
    case 'ninput':
      filteredColOtions.rounding = colOptions.rounding;
      filteredColOtions.onlyPositive = colOptions.onlyPositive;
      filteredColOtions.integerDigits = colOptions.integerDigits;
      break;
  }
  options.cols[colId] &&
    Object.keys(options.cols[colId]).forEach((key) => {
      switch (key) {
        case 'editable':
        case 'blocked':
        case 'frozen':
        case 'width':
        case 'type':
        case 'summary':
        case 'rowspan':
          break;
        default:
          delete options.cols[colId][key];
      }
    });

  Object.entries(filteredColOtions).forEach(([key, val]) => {
    if (
      colOptions[key] !== undefined &&
      { ...options.defaultCols, ...options.cols[colId] }[key] !== val
    ) {
      if (!options.cols[colId]) {
        options.cols[colId] = {};
      }
      options.cols[colId][key] = val;
    }
  });

  return options;
};

export const duplicateRow = (data: IBodyData, rowId: string) => {
  if (!data[rowId]) return data;
  const rowIndex = data[rowId].rowIndex;
  if (rowIndex === undefined) return data;
  Object.entries(data).forEach(([rowId, row]: any) => {
    if (row.rowIndex !== undefined && row.rowIndex > rowIndex) {
      const t = data[rowId];
      t.rowIndex += 1;
    }
  });
  const n = Object.keys(data).length;
  const newId = 'row_' + n + ObjectId();
  data[newId] = { ...data[rowId] };
  data[newId].rowIndex = rowIndex + 1;
  return data;
};
export const duplicateHeadRowFn = (data: IHeaderData, rowId: string) => {
  if (!data[rowId]) return data;
  const rowIndex = data[rowId].rowIndex;
  if (rowIndex === undefined) return data;
  Object.entries(data).forEach(([rowId, row]: any) => {
    if (row.rowIndex !== undefined && row.rowIndex > rowIndex) {
      const t = data[rowId];
      t.rowIndex += 1;
    }
  });
  const n = Object.keys(data).length;
  const newId = 'rowh_' + n + ObjectId();
  data[newId] = { ...data[rowId] };
  data[newId].rowIndex = rowIndex + 1;
  return data;
};

export const changedData = (data: IBodyData, changes: IChanges) => {
  if (!changes) return data;
  Object.entries(changes).forEach(([keyR, row]) =>
    Object.entries(row).forEach(([keyC, col]) => {
      if (data && data[keyR]) data[keyR][keyC] = col;
    }),
  );
  return data;
};

export const transformHeader = (headerData: IHeaderData) => {
  if (!headerData) return [];
  const newHeader: ArrayHeaderType = [];
  Object.keys(headerData)
    .sort((a, b) => headerData[a].rowIndex - headerData[b].rowIndex)
    .forEach((rowKey) => {
      'rowIndex' in headerData[rowKey] && delete headerData[rowKey].rowIndex;
      newHeader.push({
        rowId: rowKey,
        columns: headerData[rowKey],
      });
    });
  return newHeader;
};

export const validateInn = (inn: string | number) => {
  if (typeof inn === 'number') {
    inn = inn.toString();
  } else if (typeof inn !== 'string') {
    inn = '';
  }
  if (!inn.length) {
    return 'ИНН пуст';
  } else if (/[^0-9]/.test(inn)) {
    return 'ИНН может состоять только из цифр';
  } else if ([10, 12].indexOf(inn.length) === -1) {
    return 'ИНН может состоять только из 10 или 12 цифр';
  } else {
    const checkDigit = function (inn, coefficients) {
      let n = 0;
      for (const i in coefficients) {
        n += coefficients[i] * inn[i];
      }
      return (n % 11) % 10;
    };
    switch (inn.length) {
      case 10:
        const n10 = checkDigit(inn, [2, 4, 10, 3, 5, 9, 4, 6, 8]);
        if (n10 === parseInt(inn[9])) {
          return false;
        }
        break;
      case 12:
        const n11 = checkDigit(inn, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
        const n12 = checkDigit(inn, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
        if (n11 === parseInt(inn[10]) && n12 === parseInt(inn[11])) {
          return false;
        }
        break;
    }
  }
  return 'Неправильное контрольное число';
};

export const convertTemplateData = (data: IBodyData) => {
  const newData: TemplateDataType = [];
  Object.entries(data).forEach(([rowId, row]: any) => {
    newData[row.rowIndex] = { _id: rowId };
    Object.entries(row).forEach(([keyC, col]: any) => {
      if (keyC === 'rowIndex') {
        return;
      }
      newData[row.rowIndex][keyC] = col.value || '';
    });
  });

  return newData;
};

export const convertTemplateData2 = (data: TemplateDataType) => {
  const newData: IBodyData = {};
  data.forEach((t, i) => {
    const id = t._id || ObjectId();
    newData[id] = {};
    Object.keys(t).forEach((k) => {
      if (k !== '_id') newData[id][k] = { value: t[k] };
    });
    newData[id].rowIndex = i;
  });
  return newData;
};
