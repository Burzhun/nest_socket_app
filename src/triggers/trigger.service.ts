import { AxiosResponse } from 'axios';
import {
  CustomCells,
  IBodyData,
  IChanges,
  IData,
  IOptionsData,
  NewTrigger,
  NewTriggerCells,
  NewTriggers,
  OtherTableChanges,
  RequestFormulaParameters,
  SummaryType,
  TriggerCells,
} from '../types';

export class TriggerService {
  checkTriggers = (
    bodyData: IBodyData,
    triggers: NewTriggers,
    // tableId: number,
  ) => {
    const triggerCells: NewTriggerCells = {};

    Object.entries(bodyData).forEach(([keyR, row]) => {
      Object.entries(row).forEach(([keyC]) => {
        if (keyC === 'rowIndex') return;
        triggers.forEach((trigger, index) => {
          if (
            'exceptions' in trigger &&
            Array.isArray(trigger.exceptions) &&
            (trigger.exceptions.includes(keyR) ||
              trigger.exceptions.includes(keyC))
          ) {
            return;
          }
          trigger.slaves.forEach((slave) => {
            if (slave.action.type === 'invalidate') {
              switch (trigger.direction) {
                case 'vertical':
                  if (!(slave.rowId in triggerCells))
                    triggerCells[slave.rowId] = {};
                  if (!(keyC in triggerCells[slave.rowId]))
                    triggerCells[slave.rowId][keyC] = [];
                  if (triggerCells[slave.rowId][keyC].includes(index)) return;

                  triggerCells[slave.rowId][keyC] = [
                    index,
                    ...triggerCells[slave.rowId][keyC],
                  ];
                  break;
                case 'horizontal':
                  if (!(keyR in triggerCells)) triggerCells[keyR] = {};
                  if (!(slave.colId in triggerCells[keyR]))
                    triggerCells[keyR][slave.colId] = [];
                  if (triggerCells[keyR][slave.colId].includes(index)) return;

                  triggerCells[keyR][slave.colId] = [
                    index,
                    ...triggerCells[keyR][slave.colId],
                  ];
                  break;
                default:
                  if (!(slave.rowId in triggerCells))
                    triggerCells[slave.rowId] = {};
                  if (!(slave.colId in triggerCells[slave.rowId]))
                    triggerCells[slave.rowId][slave.colId] = [];
                  if (triggerCells[slave.rowId][slave.colId].includes(index))
                    return;

                  triggerCells[slave.rowId][slave.colId] = [
                    ...triggerCells[slave.rowId][slave.colId],
                    index,
                  ];
              }
            }
          });
          trigger.targets.forEach((target) => {
            switch (trigger.direction) {
              case 'vertical':
                if (!(target.rowId in triggerCells))
                  triggerCells[target.rowId] = {};
                if (!(keyC in triggerCells[target.rowId]))
                  triggerCells[target.rowId][keyC] = [];
                if (triggerCells[target.rowId][keyC].includes(index)) return;

                triggerCells[target.rowId][keyC] = [
                  index,
                  ...triggerCells[target.rowId][keyC],
                ];
                break;
              case 'horizontal':
                if (!(keyR in triggerCells)) triggerCells[keyR] = {};
                if (!(target.colId in triggerCells[keyR]))
                  triggerCells[keyR][target.colId] = [];
                if (triggerCells[keyR][target.colId].includes(index)) return;

                triggerCells[keyR][target.colId] = [
                  index,
                  ...triggerCells[keyR][target.colId],
                ];
                break;
              default:
                if (!(target.rowId in triggerCells))
                  triggerCells[target.rowId] = {};
                if (!(target.colId in triggerCells[target.rowId]))
                  triggerCells[target.rowId][target.colId] = [];
                if (triggerCells[target.rowId][target.colId].includes(index))
                  return;

                triggerCells[target.rowId][target.colId] = [
                  ...triggerCells[target.rowId][target.colId],
                  index,
                ];
            }
          });
        });
      });
    });

    // Object.keys(options.cols).forEach((col) => {
    //   if (options.cols[col].summary) {
    //     let label = options.cols[col].label;
    //     if (!label) {
    //       switch (options.cols[col].summary) {
    //         case 'SUM': {
    //           label = 'Сумма:';
    //           break;
    //         }

    //         case 'MAX': {
    //           label = 'Макс:';
    //           break;
    //         }

    //         case 'MIN': {
    //           label = 'Мин:';
    //           break;
    //         }

    //         case 'AVG': {
    //           label = 'Сред:';
    //           break;
    //         }

    //         default:
    //           label = '';
    //           break;
    //       }
    //     }
    //     if (!triggerCells[col])
    //       triggerCells[col] = {
    //         rows: {},
    //         triggers: [],
    //         summary: options.cols[col].summary,
    //         label,
    //       };
    //     else {
    //       triggerCells[col].summary = options.cols[col].summary;
    //       triggerCells[col].label = label;
    //     }
    //   }
    // });
    return triggerCells;
  };

  getUpdatedCell = (
    tableChanges: IChanges,
    oldChanges: IChanges,
    triggerChanges: IChanges,
    data: IData,
    row: string,
    column: string,
  ) => {
    if (triggerChanges[row] && triggerChanges[row][column] !== undefined)
      return triggerChanges[row][column];
    if (tableChanges[row] && tableChanges[row][column] !== undefined)
      return tableChanges[row][column];
    if (oldChanges[row] && oldChanges[row][column] !== undefined)
      return oldChanges[row][column];
    return data[row][column] || { value: '' };
  };

  updateTriggers = async (
    tableChanges: IChanges,
    triggerCells: NewTriggerCells,
    triggers: NewTrigger[],
    tableId: number,
    oldChanges: IChanges,
    data: IData,
    userId: string,
    getFormulaValueVoid: (
      formula: string,
      paramters: RequestFormulaParameters,
    ) => Promise<AxiosResponse<any, any>>,
  ): Promise<{
    tableChanges: IChanges;
    otherTableChanges?: OtherTableChanges;
  }> => {
    if (!tableChanges) return { tableChanges: {} };
    // const triggerCells = checkTriggers(tableId === 1 ? triggers : [], tableId);
    const activatedTriggerIds: number[] = [];
    for (const keyR in tableChanges) {
      for (const keyC in tableChanges[keyR]) {
        if (triggerCells[keyR] && triggerCells[keyR][keyC])
          activatedTriggerIds.push(...triggerCells[keyR][keyC]);
      }
    }
    const otherTableChanges: OtherTableChanges = {};
    if (!triggerCells) return { tableChanges: tableChanges };

    const newTableChanges: IChanges = { ...tableChanges };

    let triggerChanges: IChanges = { ...tableChanges };

    while (Object.keys(triggerChanges).length) {
      const newChanges: IChanges = {};
      for (const rowKey in triggerChanges) {
        for (const colKey in triggerChanges[rowKey]) {
          if (!(triggerCells[rowKey] && triggerCells[rowKey][colKey])) continue;
          const columnTriggers = triggerCells[rowKey][colKey];
          for (const trigger of columnTriggers) {
            for (const slaveInd in triggers[trigger].slaves) {
              const slave = triggers[trigger].slaves[slaveInd];
              const keyR = 'rowId' in slave ? slave.rowId : rowKey;

              const keyC = 'colId' in slave ? slave.colId : colKey;

              if (slave.action.type === 'formula') {
                let isParamsEmpty = true;
                const params: RequestFormulaParameters = {};
                if (slave.action.params)
                  Object.entries(slave.action.params).forEach(
                    ([keyP, param]) => {
                      const updatedValue =
                        this.getUpdatedCell(
                          tableChanges,
                          oldChanges,
                          triggerChanges,
                          data,
                          param.rowId || keyR,
                          param.colId || keyC,
                        ).value || '';
                      params[keyP] = parseFloat(
                        updatedValue?.toString() || '0',
                      );
                      if (updatedValue !== '') isParamsEmpty = false;
                    },
                  );
                else {
                  triggers[trigger].targets.forEach((target, i) => {
                    const value =
                      this.getUpdatedCell(
                        tableChanges,
                        oldChanges,
                        triggerChanges,
                        data,
                        target.rowId || keyR,
                        target.colId || keyC,
                      ).value || '';
                    params['r' + i] = parseFloat(value.toString() || '0');
                    if (value !== '') isParamsEmpty = false;
                  });
                }

                const result = await getFormulaValueVoid(
                  slave.action.formula,
                  params,
                );
                //const result = undefined;

                if (result?.data && result.data.payload) {
                  if (
                    triggers[trigger].tableId &&
                    triggers[trigger].tableId !== tableId
                  ) {
                    if (!otherTableChanges[triggers[trigger].tableId])
                      otherTableChanges[triggers[trigger].tableId] = {};
                    if (!otherTableChanges[triggers[trigger].tableId][keyR])
                      otherTableChanges[triggers[trigger].tableId][keyR] = {};
                    otherTableChanges[triggers[trigger].tableId][keyR][keyC] = {
                      // method: 'update',
                      value: isParamsEmpty ? '' : result.data.payload.result,
                    };
                  }
                  if (!newChanges[keyR]) newChanges[keyR] = {};
                  if (!newTableChanges[keyR]) newTableChanges[keyR] = {};

                  newChanges[keyR][keyC] = {
                    // method: 'update',
                    value: isParamsEmpty ? '' : result.data.payload.result,
                  };
                  newTableChanges[keyR][keyC] = newChanges[keyR][keyC];
                }
              }
              if (slave.action.type === 'invalidate') {
                const slavePrev = this.getUpdatedCell(
                  tableChanges,
                  oldChanges,
                  triggerChanges,
                  data,
                  keyR,
                  keyC,
                );
                if (slavePrev.value === undefined) slavePrev.value = '';
                if (
                  triggers[trigger].tableId &&
                  triggers[trigger].tableId !== tableId
                ) {
                  if (!otherTableChanges[triggers[trigger].tableId])
                    otherTableChanges[triggers[trigger].tableId] = {};
                  if (!otherTableChanges[triggers[trigger].tableId][keyR])
                    otherTableChanges[triggers[trigger].tableId][keyR] = {};
                  otherTableChanges[triggers[trigger].tableId][keyR][keyC] = {
                    // method: 'update',
                    ...slavePrev,
                    rowIndex: data[keyR]['rowIndex'] as unknown as string,
                    userId,
                  };
                }
                if (!newTableChanges[keyR]) newTableChanges[keyR] = {};
                slave.action;

                newTableChanges[keyR][keyC] = {
                  ...slavePrev,
                  rowIndex: data[keyR]['rowIndex'] as unknown as string,
                  userId,
                };
                for (const target of triggers[trigger].targets) {
                  const targetVal =
                    parseFloat(
                      this.getUpdatedCell(
                        tableChanges,
                        oldChanges,
                        triggerChanges,
                        data,
                        target['rowId'] || keyR,
                        target['colId'] || keyC,
                      ).value?.toString() || '0',
                    ) || 0;
                  const slaveVal = slavePrev?.value
                    ? parseFloat(slavePrev.value?.toString())
                    : 0;
                  if (newTableChanges[keyR][keyC].inValidMessage)
                    delete newTableChanges[keyR][keyC].inValidMessage;
                  switch (target.condition) {
                    case 'is_less':
                      if (slaveVal >= targetVal) {
                        newTableChanges[keyR][keyC].inValidMessage =
                          'Значение должно быть меньше ' + targetVal;
                      }
                      break;
                    case 'is_greater':
                      if (slaveVal <= targetVal) {
                        newTableChanges[keyR][keyC].inValidMessage =
                          'Значение должно быть больше ' + targetVal;
                      }
                      break;
                    case 'not_more':
                      if (slaveVal > targetVal) {
                        newTableChanges[keyR][keyC].inValidMessage =
                          'Значение должно быть не больше ' + targetVal;
                      }

                      break;
                    case 'not_less':
                      if (slaveVal < targetVal) {
                        newTableChanges[keyR][keyC].inValidMessage =
                          'Значение должно быть не меньше ' + targetVal;
                      }
                      break;
                    case 'not_equal':
                      if (slaveVal === targetVal) {
                        newTableChanges[keyR][keyC].inValidMessage =
                          'Значение должно быть не равно ' + targetVal;
                      }
                      break;
                    default:
                      break;
                  }
                }
              }
            }
          }
        }
      }
      triggerChanges = { ...newChanges };
    }

    return { tableChanges: newTableChanges, otherTableChanges };
  };

  compare = (
    condition: string,
    value: string | string[],
    checkValue: string,
  ) => {
    if (value === undefined) value = '';

    const isArray = Array.isArray(value);

    switch (condition) {
      case 'equal':
        return isArray ? value.includes(checkValue) : value === checkValue;
      case 'not_equal':
        return isArray ? !value.includes(checkValue) : value !== checkValue;
      case 'empty':
        return isArray ? value.length === 0 : value === '';
      case 'not_empty':
        return isArray ? value.length > 0 : value !== '';
      case 'includes':
        return isArray
          ? !(value as string[]).find((el) => !checkValue.includes(el)) &&
              value.length > 0
          : Array.isArray(checkValue) && checkValue.includes(value);
      case 'not_includes':
        return isArray
          ? !(value as string[]).find((el) => checkValue.includes(el)) ||
              value.length === 0
          : Array.isArray(checkValue) && !checkValue.includes(value);
    }

    return false;
  };

  checkConditionTriggers = (
    tableData: IBodyData,
    tableChanges: IChanges,
    triggerCells: NewTriggerCells,
    triggers: NewTriggers,
  ) => {
    const newCustomCells: CustomCells = {};
    let triggerChanges: IChanges = { ...tableChanges };
    while (Object.keys(triggerChanges).length) {
      const newChanges: IChanges = {};
      for (const rowKey in triggerChanges) {
        for (const colKey in triggerChanges[rowKey]) {
          if (!triggerCells[rowKey]) continue;
          const columnTriggers = triggerCells[rowKey][colKey];
          if (columnTriggers) {
            if (columnTriggers?.length) {
              columnTriggers.forEach((triggerNumber) => {
                const trigger = triggers[triggerNumber];
                if (!trigger.targets.find((t) => t.condition)) return;
                const match = !trigger.targets.find((t) => {
                  let value = tableData[rowKey][t.colId]
                    ? tableData[rowKey][t.colId].value || ''
                    : 0;
                  if (tableChanges[rowKey][t.colId])
                    value = tableChanges[rowKey][t.colId].value || '';

                  return !this.compare(t.condition, value.toString(), '');
                });
                if (!newCustomCells[rowKey]) newCustomCells[rowKey] = {};
                if (!newChanges[rowKey]) newChanges[rowKey] = {};
                trigger.slaves.forEach((s) => {
                  if (s.action.type === 'invalidate') return;
                  newCustomCells[rowKey][s.colId] = {
                    editable:
                      s.action.type === 'block'
                        ? !Boolean(match)
                        : Boolean(match),
                  };
                  newChanges[rowKey][s.colId] = {
                    rowIndex: rowKey,
                    userId: '1',
                    value: '',
                  };
                });
              });
            }
          }
        }
      }
      triggerChanges = { ...newChanges };
    }

    return newCustomCells;
  };

  checkConditionTriggersOnStart = (
    tableData: IBodyData,
    changes: IChanges,
    triggerCells: NewTriggerCells,
    triggers: NewTriggers,
  ) => {
    Object.keys(tableData).forEach((rowKey) => {
      changes[rowKey] = {};
      const rowIndex = tableData[rowKey].rowIndex.toString();
      Object.keys(tableData[rowKey]).forEach((colKey) => {
        if (colKey !== 'rowIndex') {
          changes[rowKey][colKey] = {
            value: tableData[rowKey][colKey]
              ? tableData[rowKey][colKey].value
              : 0,
            rowIndex,
            userId: '0',
          };
        }
      });
    });

    return this.checkConditionTriggers(
      tableData,
      changes,
      triggerCells,
      triggers,
    );
  };

  setCustomCells = (customCells: CustomCells, newCustomCells: CustomCells) => {
    Object.entries(newCustomCells).forEach(([keyR, row]) => {
      Object.entries(row).forEach(([keyC, col]) => {
        if (!(keyR in customCells)) {
          customCells[keyR] = {};
        }
        if (!(keyC in customCells[keyR])) {
          customCells[keyR][keyC] = {};
        }
        if (
          newCustomCells[keyR][keyC].editable ===
          customCells[keyR][keyC]?.editable
        ) {
          delete newCustomCells[keyR][keyC];
        } else
          customCells[keyR][keyC] = {
            ...customCells[keyR][keyC],
            ...col,
          };
      });
    });

    return customCells;
  };

  getColumnData = (column: string, changes: IChanges, data: IData) => {
    const values: number[] = [];
    Object.keys(data).forEach((rowKey) => {
      if (changes && changes[rowKey] && changes[rowKey][column] !== undefined) {
        values.push(
          parseFloat(changes[rowKey][column].value?.toString() || '0'),
        );
      } else {
        values.push(
          parseFloat(
            (data[rowKey][column] && data[rowKey][column].value?.toString()) ||
              '0',
          ),
        );
      }
    });
    return values;
  };

  checkSummaryValues = (
    changes: IChanges,
    data: IData,
    triggerCells: TriggerCells,
    options?: IOptionsData,
  ) => {
    if (!triggerCells || !options) return {};
    if (!options.cols) options.cols = {};
    let updatedColumns: string[] = [];
    if (options) {
      updatedColumns = Object.keys(options.cols).filter(
        (c) => options.cols[c].summary,
      );
    } else {
      Object.keys(changes).forEach((rowKey) => {
        Object.keys(changes[rowKey]).forEach((colKey) => {
          if (!updatedColumns.includes(colKey)) updatedColumns.push(colKey);
        });
      });
    }
    const summaryValues: SummaryType = {};
    updatedColumns.forEach((colKey) => {
      if (triggerCells[colKey] && triggerCells[colKey].summary) {
        const values = this.getColumnData(colKey, changes, data);
        let result = '';
        switch (triggerCells[colKey].summary) {
          case 'SUM': {
            result = values.reduce((a, b) => a + b, 0).toString();
            break;
          }

          case 'MAX': {
            result = values.length > 0 ? Math.max(...values).toString() : '';
            break;
          }

          case 'MIN': {
            result = values.length > 0 ? Math.min(...values).toString() : '';
            break;
          }

          case 'AVG': {
            result =
              values.length > 0
                ? (values.reduce((a, b) => a + b, 0) / values.length).toString()
                : '';
          }
          default:
            result = '';
            break;
        }
        summaryValues[colKey] = triggerCells[colKey].label + ' ' + result;
      }
    });
    return summaryValues;
  };

  checkChangeUpdates = (changes: IChanges, tableData: IBodyData) => {
    for (const row in changes) {
      for (const col in changes[row]) {
        if (
          !tableData[row] ||
          !tableData[row][col] ||
          tableData[row][col].value !== changes[row][col].value
        )
          return true;
      }
    }
    return false;
  };
}
