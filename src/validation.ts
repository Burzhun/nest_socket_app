import { validateInn } from './app/dataTransformers';
import { RedisService } from './redis/redis.service';
import {
  ConstructorMessage,
  SchemeData,
  UpdateMessagePayload,
  ValidationRule,
} from './types';

export const checkValidators = async (
  scheme: SchemeData,
  redis: RedisService,
  payload: UpdateMessagePayload,
  userId: string,
) => {
  let initialBlocks = await redis.get('blocks' + payload.tableId.toString());
  if (!initialBlocks) {
    await redis.set('blocks' + payload.tableId.toString(), {});
    initialBlocks = {};
  }
  // const initialInValids = await redis.get(
  //   'inValidChanges' + payload.tableId.toString(),
  // );
  const validationRules = scheme.validationRules;
  if (!validationRules) {
    return { blocks: {}, changes: payload.data };
  }
  const newChanges = {};
  // let validOptions = redis.get('validOption' + payload.tableId.toString());

  Object.entries(payload.data).forEach(([keyR, row]) => {
    Object.entries(row).forEach(([keyC, col]) => {
      const blockedCell =
        initialBlocks &&
        Object.keys(initialBlocks).length &&
        Object.entries(initialBlocks).find(
          (val: [string, any]) => keyR in val[1] && keyC in val[1][keyR],
        );
      Array.isArray(blockedCell) &&
        blockedCell[0] &&
        delete initialBlocks[blockedCell[0]];
      let cellValidation: ValidationRule;
      if (
        'customCells' in validationRules &&
        keyR in validationRules.customCells &&
        keyC in validationRules.customCells[keyR] &&
        validationRules.customCells[keyR][keyC].type
      ) {
        cellValidation = validationRules.customCells[keyR][keyC];
      } else if (validationRules.cols && keyC in validationRules.cols) {
        cellValidation = validationRules.cols[keyC];
      }

      const isValid =
        !cellValidation ||
        (Object.keys(cellValidation).length &&
          checkValidator(col.value.toString(), cellValidation));

      if (keyR in newChanges) {
        newChanges[keyR] = {
          ...newChanges[keyR],
          [keyC]: { ...col, userId },
        };
      } else {
        newChanges[keyR] = {};
        newChanges[keyR][keyC] = col;
      }

      if (!isValid) {
        newChanges[keyR][keyC].inValidMessage = cellValidation.errorMessage;
      }
    });
  });

  return {
    blocks: initialBlocks,
    changes: newChanges,
  };
};

const validationFunctions = {
  regExp: (validationRule: ValidationRule, value: string) => {
    const regExp = new RegExp(validationRule.regExp.replaceAll('//', '/'), 'i');
    return regExp.test(value);
  },
  inn: (validationRule: ValidationRule, value: string) => {
    if (!value) return true;
    return !validateInn(value);
  },
};

const checkValidator = (value: string, rule: ValidationRule) => {
  if (!rule.type) {
    if (rule.regExp) rule.type = 'regExp';
    else return true;
  }
  if (validationFunctions[rule.type]) {
    return validationFunctions[rule.type](rule, value);
  }
  return true;
};

export const addValidationRules = async (
  scheme: SchemeData,
  payload: ConstructorMessage,
) => {
  if (payload.messageType === 'editColumn' && payload.colId) {
    if (!scheme.validationRules.cols) scheme.validationRules.cols = {};
    scheme.validationRules.cols[payload.colId] = {};
    if (payload.colOptions.type === 'inn') {
      scheme.validationRules.cols[payload.colId] = {
        type: 'inn',
        errorMessage: 'Некорректный ИНН',
      };
    }
    if (payload.colOptions.type === 'input' && payload.colOptions.regExp) {
      scheme.validationRules.cols[payload.colId] = {
        type: 'regExp',
        regExp: payload.colOptions.regExp,
        errorMessage:
          payload.colOptions.errorMessage || 'Некорректное значение',
      };
    }
  }
  if (payload.messageType === 'editCell' && payload.colId && payload.rowId) {
    if (!scheme.validationRules.customCells[payload.rowId])
      scheme.validationRules.customCells[payload.rowId] = {};
    scheme.validationRules.customCells[payload.rowId][payload.colId] = {};
    if (payload.colOptions.type === 'inn') {
      scheme.validationRules.customCells[payload.rowId][payload.colId] = {
        type: 'inn',
        errorMessage: 'Некорректный ИНН',
      };
    }
    if (payload.colOptions.type === 'input' && payload.colOptions.regExp) {
      scheme.validationRules.customCells[payload.rowId][payload.colId] = {
        type: 'regExp',
        regExp: payload.colOptions.regExp,
        errorMessage: 'Некорректный ИНН',
      };
    }
  }
};
