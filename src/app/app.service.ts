import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios/dist';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  CustomCells,
  IBodyData,
  IChanges,
  NewTriggerCells,
  ProjectStore,
  RequestFormulaParameters,
  SchemeData,
  TableStore,
} from '../types';
import { SchemeService } from 'src/scheme/scheme.sevice';
import { TableService } from 'src/table/table.service';
import {
  ObjectId,
  changedData,
  convertLoadedData,
} from 'src/app/dataTransformers';

import { RedisService } from 'src/redis/redis.service';
import { TriggerService } from 'src/triggers/trigger.service';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
    private schemeService: SchemeService,
    private tableService: TableService,
    private redisService: RedisService,
    private readonly triggerService: TriggerService,
  ) {}
  private readonly logger = new Logger(AppService.name);

  async getFormulaValue(formula: string, parameters: RequestFormulaParameters) {
    const host = this.configService.get('PERELMAN_SERVICE');
    if (!host) return undefined;
    const token = 'Bearer ' + this.configService.get('TOKEN');
    const data = firstValueFrom(
      this.httpService.post(
        `${host}/api/expect`,
        {
          expression: formula,
          parameters,
        },
        {
          headers: {
            Authorization: token,
          },
        },
      ),
    );
    return data;
  }

  async getTablesList(projectId: string) {
    try {
      const projectStore: ProjectStore =
        (await this.redisService.get('projectStore')) || {};
      if (!projectStore[projectId]) {
        const projectTablesList = await this.tableService.loadTablesList(
          projectId,
        );
        if (projectTablesList.data.payload.length) {
          projectStore[projectId] = projectTablesList.data.payload.map((t) => ({
            tableId: t.id,
          }));
          this.redisService.set('projectStore', projectStore).catch((e) => {
            console.log(e);
          });
          return projectStore[projectId];
        }

        return [];
      } else {
        return projectStore[projectId];
      }
    } catch {
      return [];
    }
  }

  async deleteProjectTables(projectId: string, clearData: boolean) {
    const projectStore: ProjectStore =
      (await this.redisService.get('projectStore')) || {};
    if (clearData) {
      for (const t of projectStore[projectId]) {
        await this.redisService.del('changes' + t.tableId);
        await this.redisService.del('blocks' + t.tableId);
        await this.redisService.del('dataTable' + t.tableId);
        await this.redisService.del('headerData' + t.tableId);
        await this.redisService.del('validationRules' + t.tableId);
      }
    }
    if (projectStore[projectId]) {
      delete projectStore[projectId];
      await this.redisService.set('projectStore', projectStore);
    }
  }

  async loadTable(
    tableStore: TableStore,
    projectId: number,
    tableId: number,
  ): Promise<[TableStore, IBodyData, SchemeData]> {
    this.logger.log(`loading ${projectId} ${tableId}`);
    const requestData = await this.tableService.getTable(projectId, tableId);
    const tableRequestData = requestData.data.payload;
    const schemeId = tableRequestData.schemeId;

    this.schemeService.storeSchemeTable(schemeId, tableId);
    const scheme = await this.schemeService.getScheme(
      tableRequestData.schemeId,
    );

    const keyTableData = 'dataTable' + tableId;
    const keySchemeOption = 'schemeOption' + schemeId;

    tableStore = {
      ...tableStore,
      [tableId]: {
        dataKey: keyTableData,
        schemeKey: keySchemeOption,
        readonly: tableRequestData.readonly || false,
        schemeId,
      },
    };

    const tableData: IBodyData = Array.isArray(tableRequestData.data)
      ? convertLoadedData(tableRequestData.data, scheme.options)
      : tableRequestData.data;

    // await this.redisService.set('logs', {
    //   tableData: tableRequestData.data,
    //   scheme,
    // });

    await this.redisService.set(keyTableData, tableData);

    await this.redisService.set(keySchemeOption, scheme);
    await this.redisService.set('tablesState', tableStore);

    const validationRules = scheme.validationRules || {
      cols: {},
      customCells: {},
    };
    await this.redisService.set('validationRules' + tableId, validationRules);

    return [tableStore, tableData, scheme];
  }

  async setTableData(tableId: number, data: IBodyData, scheme: SchemeData) {
    const blocks = (await this.redisService.get('blocks' + tableId)) || {};
    const changes: IChanges =
      (await this.redisService.get('changes' + tableId)) || {};

    if (!changes) {
      this.redisService.set('changes' + tableId, {}).catch((e) => {
        console.log(e);
      });
    }
    if (!blocks) {
      this.redisService.set('blocks' + tableId, {}).catch((e) => {
        console.log(e);
      });
    }

    if (changes) data = changedData(data, changes) || {};

    if (!Object.keys(data).length) {
      const newId = 'row_' + ObjectId();
      data[newId] = {};
      data[newId].rowIndex = 0;
    }

    let triggerCells: NewTriggerCells = await this.redisService.get(
      'triggerCells' + tableId,
    );

    if (scheme.triggers) {
      triggerCells = this.triggerService.checkTriggers(
        data,
        scheme.triggers,
        // tableId,
      );
      const newCustomCells: CustomCells =
        this.triggerService.checkConditionTriggersOnStart(
          data,
          changes,
          triggerCells,
          scheme.triggers,
        );

      if (newCustomCells && Object.keys(newCustomCells).length) {
        scheme.options.customCells = this.triggerService.setCustomCells(
          scheme.options.customCells,
          newCustomCells,
        );
      }
      await this.redisService
        .set('triggerCells' + tableId, triggerCells)
        .catch((e) => {
          console.log(e);
        });
      return triggerCells;
    } else {
      await this.redisService.set('triggerCells' + tableId, {}).catch((e) => {
        console.log(e);
      });
      return {};
    }
  }

  async loadProjectData(
    projectId: number,
    tableId: number,
    tableStore: TableStore,
  ) {
    const projectData = await this.getTablesList(projectId.toString());
    if (projectData && projectData.length) {
      for (const t of projectData) {
        if (t.tableId !== tableId) {
          this.logger.log(`loading ${projectId} ${tableId} ${t.tableId}`);
          try {
            const requestData = await this.tableService.getTable(
              projectId,
              t.tableId,
            );
            const tableRequestData = requestData.data.payload;
            const schemeId = tableRequestData.schemeId;

            this.schemeService.storeSchemeTable(schemeId, t.tableId);
            const scheme = await this.schemeService.getScheme(
              tableRequestData.schemeId,
            );

            const keyTableData = 'dataTable' + t.tableId;
            const keySchemeOption = 'schemeOption' + schemeId;

            tableStore = {
              ...tableStore,
              [t.tableId]: {
                dataKey: keyTableData,
                schemeKey: keySchemeOption,
                readonly: tableRequestData.readonly || false,
                schemeId,
              },
            };

            const tableData: IBodyData = Array.isArray(tableRequestData.data)
              ? convertLoadedData(tableRequestData.data, scheme.options)
              : tableRequestData.data;

            await this.redisService.set(keyTableData, tableData);

            await this.redisService.set(keySchemeOption, scheme);
          } catch {}
        }
      }
      await this.redisService.set('tablesState', tableStore);
    }
  }
}
