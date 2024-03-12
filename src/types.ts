import { Server } from 'socket.io';

export interface ICell {
  value: string | number;
  selected?: { label: string; value: string };
  label?: string;
  id?: string;
}
export interface IHeaderCell {
  value?: string;
  colSpan?: number;
}
export interface IHeaderData {
  [key: string]: IHeaderRowData;
}
export type IHeaderRowData = {
  [key: string]: IHeaderCell;
} & { rowIndex?: number };

export type ArrayHeaderType = {
  rowId: string;
  columns: { [key: string]: IHeaderCell };
}[];

export interface IData {
  [key: string]: {
    [key: string]: ICell;
  };
}

export type CustomCells = {
  [row: string]: {
    [colId: string]: ITableCellOption & { blocked?: boolean };
  };
};

export type TTrigerActionType =
  | {
      formula: string;
      type: 'formula';
      params?: {
        [key: string]: {
          colId?: string;
          rowId?: string;
        };
      };
    }
  | {
      type: 'block';
    }
  | {
      type: 'unblock';
    }
  | {
      type: 'invalidate';
    };
export type TTrigerConditionType =
  | 'is_greater'
  | 'is_less'
  | 'not_more'
  | 'not_less'
  | 'equal'
  | 'not_equal'
  | 'includes'
  | 'not_includes'
  | 'empty'
  | 'not_empty';

export type NewTriggers = NewTrigger[];

export type NewTrigger = {
  tableId?: number;
  exceptions?: string[];
  direction: 'both' | 'vertical' | 'horizontal';
  targets: {
    rowId?: string;
    colId?: string;
    condition?: TTrigerConditionType;
  }[];
  slaves: {
    action: TTrigerActionType;
    rowId?: string;
    colId?: string;
  }[];
};

export interface IOptionsData {
  fixedColumns?: number;
  colRound: number;
  rowRound: number;
  defaultCols: { frozen: boolean; type: string; width: number };
  defaultRows: { height: number };
  customCells: CustomCells;
  columnsList?: string[];

  cols: {
    [key: string]: ITableCellOption;
  };
  rows: {
    [key: string]: {
      height?: number;
    };
  };
  triggers?: NewTriggers;
}

export interface IValidationData {
  [key: string]: {
    [key: string]: {
      value: string;
    };
  };
}

export type TCellSelected = {
  value: string;
  label: string;
}[];
export interface ITableCellOption {
  editable?: boolean;
  blocked?: boolean;
  frozen?: boolean;
  width?: number;
  type?: TCellTypes;
  summary?: string;
  //main types
  rounding?: number;
  selectOptionsPath?: string;
  asyncTargetOptions?: { [colId: string]: string };
  selectOptions?: TCellSelected;
  maxSize?: number;
  formats?: string[];
  selectPlaceholder?: string;
  onlyPositive?: boolean;
  integerDigits?: number;
  regExp?: string;
  rowSpan?: number;
  errorMessage?: string;
}

export type TableState = {
  readonly: boolean;
  message: string;
  schemeId: number;
  data?: IBodyData;
};

export type TCellTypes =
  | 'counter'
  | 'text'
  | 'inn'
  | 'select'
  | 'mselect'
  | 'aselect'
  | 'amselect'
  | 'input'
  | 'upload'
  | 'ninput'
  | 'calendar';
export type TablesState = {
  [tableId: number]: TableState;
};

export type TableStore = {
  [key: string]: {
    dataKey: string;
    schemeKey: string;
    message?: string;
    readonly: boolean;
    schemeId: number;
  };
};

export type TTableData = {
  tablesState?: TableStore;
  bodyData?: IBodyData;
  headerData?: IHeaderData;
  options?: IOptionsData;
  blocks?: IBlocks;
  changes?: IChanges;
  validationRules?: ValidationRules;
  inValidChanges?: IInValidsData;
  triggerCells?: NewTriggerCells;
};

export type TableChange = {
  [row_index: string]: {
    [column_index: string]: {
      value: string | number;
      userId?: string;
    };
  };
};

export type CellBlocks = {
  [socketId: string]: {
    [rowId: string]: {
      [cellId: string]: {
        blocked?: boolean;
      };
    };
  }[];
};

export type FormulaParameters = {
  [key: string]: {
    key: string;
    row: number;
  };
};

export type Trigger = {
  id: number;
  action?: {
    type: 'formula' | 'formulaV2' | 'block' | 'unblock';
    formula: string;
    params?: FormulaParameters;
    value?: string | string[];
    condition?:
      | 'equal'
      | 'not_equal'
      | 'includes'
      | 'not_includes'
      | 'empty'
      | 'not_empty';
  };
  actionArray?: {
    type: 'formula' | 'formulaV2' | 'block' | 'unblock';
    formula: string;
    slave: string;
    rowSlave?: number;
    params?: FormulaParameters;
    value?: string | string[];
    condition?:
      | 'equal'
      | 'not_equal'
      | 'includes'
      | 'not_includes'
      | 'empty'
      | 'not_empty';
  }[];
  tableId?: number;
  slave: string;
  rowSlave?: number;
  target:
    | {
        row?: string;
        key: string;
      }[]
    | string[];
};

export type TriggerCell = {
  type: 'formula' | 'formulaV2' | 'block' | 'unblock';
  updatedField: string;
  params?: FormulaParameters;
  triggerId: number;
  rowSlave?: number;
  tableId?: number;
  value?: string | string[];
  condition?:
    | 'equal'
    | 'not_equal'
    | 'includes'
    | 'not_includes'
    | 'empty'
    | 'not_empty';
  target?:
    | {
        row?: string;
        key: string;
      }[]
    | string[];
  formula: string;
};

export type NewTriggerCells = {
  [rowId: string]: {
    [colId: string]: number[];
  };
};
export interface TriggerCells {
  [colId: string]: {
    triggers?: TriggerCell[];
    summary?: string;
    label?: string;
    rows?: {
      [rowId: string]: TriggerCell[];
    };
  };
}

export type RequestFormulaParameters = {
  [key: string]: number;
};
export interface IBlocks {
  [key: string]: {
    [key: string]: {
      [key: string]: {
        rowIndex: string;
      };
    };
  };
}
export interface IBlocksTransformed {
  [key: string]: string[];
}
export interface IInValidsData {
  [key: string]: IInValidsDataExactUser;
}
export interface IInValidsDataExactUser {
  [key: string]: {
    [key: string]: IInValidsCell;
  };
}

export interface IBodyData {
  [key: string]: {
    [key: string]: ICell;
  } & { rowIndex?: number };
}
export interface IChanges {
  [rowId: string]: {
    [colId: string]: IChangeCell;
  };
}

export interface IChangeCell extends ICell {
  inValidMessage?: string;
  rowIndex?: string;
  userId?: string;
}
export interface IInValidsCell {
  rowIndex: string;
  errorMessage: string;
  value: string;
}

export interface ISortedBodyRow {
  [key: string]: {
    value: string;
    rowId: string;
  };
}

export type TableDataListRow = {
  rowId: string;
  data: {
    [colKey: string]: {
      value: string;
    };
  };
};
export type TableDataList = TableDataListRow[];
// export interface ILoadTable{

// }
export type ITransformingData<T extends IChanges | IInValidsDataExactUser> = (
  data: T,
) => T;

export type UpdateMessagePayload = {
  tableId: number;
  data: IChanges;
};

export type OtherTableChanges = {
  [tableId: number]: IChanges;
};

export type SummaryType = {
  [column: string]: string;
};

export type SchemeData = {
  headerData: IHeaderData;
  options: IOptionsData;
  validationRules?: ValidationRules;
  triggers?: NewTrigger[];
  useFilters?: boolean;
};

export type SchemeRequestResponse = {
  payload: SchemeData;
};

export type TableRequestResponse = {
  payload: TableState;
};

export type TableListRequestResponse = {
  payload: {
    id: number;
    title: string;
    userId?: number;
    canCopy?: boolean;
    canCreate?: boolean;
  }[];
};

export type TableTemplateListRequestResponse = {
  payload: {
    result: {
      id: number;
    }[];
  };
};

export type TableSaveResponse = {
  comment: string;
  createdAt: string;
  creatorId: number;
  data: string;
  deletedAt: string;
  id: number;
  project_id: number;
  rows_count: number;
  table_id: number;
  transformation_status: number;
  updatedAt: string;
};

export type ProjectSaveResponse = {
  message: string;
  status: boolean;
};

//export type TableDataList = {};

export type ProjectData = {
  tableId: string;
  data: IBodyData;
}[];

export type SavedDataRowType = {
  _id: string;
  [key: string]: { value: string; label?: string; id?: string } | string;
};

export type SavedTableType = SavedDataRowType[];

export type TableSaveDataType = {
  tableId: number;
  data: IBodyData;
};

export type ProjectSaveDataType = {
  tables: TableSaveDataType[];
};

export type ProjectStore = {
  [projectId: string]: {
    tableId: number;
    schemeId?: number;
  }[];
};

export type ReloadTablesList = {
  tableIds: number[];
};

export type SchemeStore = {
  [schemeId: number]: number[];
};

export type RowRequestType = 'add' | 'addBefore' | 'delete' | 'duplicate';

export interface IReqData {
  newData: {
    [key: string]:
      | {
          [key: string]: {
            value?: string;
          };
        }
      | string;
  };
  type: 'block' | 'update' | 'unblock';
}

type ConstructorMessageType =
  | 'editCell'
  | 'deleteTrigger'
  | 'editTrigger'
  | 'addTrigger'
  | 'updateValue'
  | 'duplicateRow'
  | 'editHeadRow'
  | 'addHeadRow'
  | 'duplicateHeadRow'
  | 'deleteHeadRow'
  | 'addRow'
  | 'deleteRow'
  | 'addColumn'
  | 'editColumn'
  | 'editRow'
  | 'deleteColumn'
  | 'duplicateColumn'
  | 'deleteColumn';

export type ConstructorMessage = {
  messageType: ConstructorMessageType;
  rowId?: string;
  triggerIndex?: number;
  colId?: string;
  before?: boolean;
  isHeadRow?: boolean;
  newData?: IReqData['newData'];
  colOptions?: ITableCellOption;
  triggerData?: NewTrigger;
  headRowData?: IHeaderCell[];
  rowData?: ICell[];
  cellOptions?: ITableCellOption;
  currentRowId?: string;
  templateId?: number;
  tableId?: number;
  projectTemplateId?: number;
  token?: string;
  alertMessage?: string;
  templatesList?: number[];
};

export type ConstructorFunctions = {
  [type in ConstructorMessageType]?: (
    server: Server,
    payload: ConstructorMessage,
  ) => Promise<void> | ((server: Server, payload: ConstructorMessage) => void);
};

export type ValidationRule = {
  errorMessage?: string;
  regExp?: string;
  type?: 'inn' | 'regExp';
};

export type ValidationRules = {
  cols: {
    [colId: string]: ValidationRule;
  };
  customCells: {
    [rowId: string]: {
      [colId: string]: ValidationRule;
    };
  };
};

export type TableTemplateType = {
  id: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  name: string;
  description: string;
  legend: string;
  schemeId: number;
  templateProjectId: number;
  number: number;
  templateData: string;
  type: 'static' | 'dinamic';
  canCreate: boolean;
  canCopy: boolean;
  prefilling: string;
  validationId: number;
  method: string;
  plugin: string;
};

export type TableTemplatesResponse = {
  payload: {
    result: TableTemplateType[];
  };
  status: string;
};

export type TemplateDataTypeRow = {
  [key: string]: string;
} & { _id?: string };

export type TemplateDataType = TemplateDataTypeRow[];

export type ProjectTemplates = {
  [projectTemplateId: number]: number[];
};

export type ExcelPdfTableRequest = {
  id: number;
  number: number;
  name: string;
  data: {
    rows: {
      [rowId: string]: {
        orderIndex: number;
        cells: {
          [colId: string]: {
            value: string;
          };
        };
      };
    };
  };
  options: {
    header: {
      rows: {
        columns: {
          title: string;
          width: number;
          cells: number;
        }[];
        height: number;
      }[];
    };
    columns: {
      key: string;
      type: string;
    }[];
  };
};

export type SignData = {
  name: string;
  issuerName: string;
  subjectName: string;
  thumbprint: string;
  validFrom: string;
  validTo: string;
};

export type SignDataPayload = {
  payload: SignData;
};

export type ExcelPdfRequest = {
  id: number;
  name: string;
  plugin: string;
  tables: ExcelPdfTableRequest[];
  signerData?: SignData;
};

export type ExcelFileResponse = {
  data: {
    status: string;
    payload: string;
  };
};
