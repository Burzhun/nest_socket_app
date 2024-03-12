import { HttpException, Injectable } from '@nestjs/common';
import {
  ConstructorMessage,
  IBodyData,
  ProjectTemplates,
  SchemeData,
  SchemeRequestResponse,
  TableListRequestResponse,
  TableStore,
  TableTemplateListRequestResponse,
  TableTemplateType,
  TableTemplatesResponse,
  TemplateDataType,
} from 'src/types';
import { Server } from 'socket.io';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from 'src/redis/redis.service';
import { SchemeService } from 'src/scheme/scheme.sevice';
import {
  ObjectId,
  addHeadRowFn,
  convertTemplateData,
  convertTemplateData2,
  dataSorterArray,
  dataTransform,
  deleteHeadRowFn,
  duplicateHeadRowFn,
  editHeadRowFn,
  mergeOptionChanges,
  transformHeader,
} from 'src/app/dataTransformers';
import { addValidationRules } from 'src/validation';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class ConstructorService {
  private host: string;
  private token: string;
  private adminServiceHost: string;

  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
    private redisService: RedisService,
    private schemeService: SchemeService,
  ) {
    this.host = this.configService.get('SERVER_HOST');
    this.token = this.configService.get('TOKEN');
    this.adminServiceHost = this.configService.get('ADMIN_SERVICE');
  }

  async sendUpdatedScheme(
    server: Server,
    scheme: SchemeData,
    templateId: number,
    schemeId: number,
    schemeKey: string,
    saveTriggers = false,
  ) {
    await this.redisService.set(schemeKey, scheme);

    server.to('templateTableRoom' + templateId).emit(
      'updateOptions',
      saveTriggers
        ? {
            triggers: scheme.triggers,
          }
        : {
            triggers: scheme.triggers,
            options: scheme.options,
            headerData: transformHeader(scheme.headerData),
          },
    );
  }

  async updateMessage(server: Server, payload: ConstructorMessage) {
    console.log(payload);
    if (this[payload.messageType]) this[payload.messageType](server, payload);
  }

  async editColumn(server: Server, payload: ConstructorMessage) {
    if (payload.colOptions && payload.colId && payload.templateId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        addValidationRules(scheme, payload);
        scheme.options = mergeOptionChanges(
          scheme.options,
          payload.colOptions,
          payload.colId,
        );
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }

  async addHeadRow(server: Server, payload: ConstructorMessage) {
    if (payload.headRowData && payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        scheme.headerData = addHeadRowFn(
          scheme.options.columnsList,
          scheme.headerData,
          payload.headRowData,
          payload.currentRowId,
          payload.before,
        );
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }
  async editHeadRow(server: Server, payload: ConstructorMessage) {
    if (payload.headRowData && payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        scheme.headerData = editHeadRowFn(
          scheme.options.columnsList,
          scheme.headerData,
          payload.headRowData,
          payload.currentRowId,
        );
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }
  async resetCustomCell(server: Server, payload: ConstructorMessage) {
    if (payload.colId && payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        if (
          scheme.options.customCells[payload.currentRowId] &&
          scheme.options.customCells[payload.currentRowId][payload.colId]
        ) {
          delete scheme.options.customCells[payload.currentRowId][
            payload.colId
          ];
          if (
            Object.values(scheme.options.customCells[payload.currentRowId])
              .length
          )
            delete scheme.options.customCells[payload.currentRowId];
        }
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }

  async duplicateHeadRow(server: Server, payload: ConstructorMessage) {
    if (payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        scheme.headerData = duplicateHeadRowFn(
          scheme.headerData,
          payload.currentRowId,
        );
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }
  async deleteHeadRow(server: Server, payload: ConstructorMessage) {
    if (payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        scheme.headerData = deleteHeadRowFn(
          scheme.headerData,
          payload.currentRowId,
        );
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }

  async addColumn(server: Server, payload: ConstructorMessage) {
    if (payload.colOptions && payload.colId) {
      const newId = 't' + ObjectId();
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);

        const idIndexInList = scheme.options.columnsList.indexOf(payload.colId);
        Object.keys(scheme.headerData).forEach((keyR) => {
          const objList = Object.keys(scheme.headerData[keyR]);

          if (payload.before) {
            if (
              scheme.headerData[keyR][scheme.options.columnsList[idIndexInList]]
            ) {
              scheme.headerData[keyR][newId] = {
                colSpan: 1,
                value: '',
              };
            } else {
              for (let i = idIndexInList - 1; i >= 0; i--) {
                if (objList.includes(scheme.options.columnsList[i])) {
                  scheme.headerData[keyR][
                    scheme.options.columnsList[i]
                  ].colSpan += 1;
                  break;
                }
              }
            }
          } else if (!payload.before) {
            if (
              scheme.headerData[keyR][
                scheme.options.columnsList[idIndexInList + 1]
              ]
            ) {
              scheme.headerData[keyR][newId] = {
                colSpan: 1,
                value: '',
              };
            } else {
              for (let i = idIndexInList; i >= 0; i--) {
                if (objList.includes(scheme.options.columnsList[i])) {
                  scheme.headerData[keyR][
                    scheme.options.columnsList[i]
                  ].colSpan += 1;
                  break;
                }
              }
            }
          }
        });
        scheme.options.columnsList.splice(
          payload.before ? idIndexInList : idIndexInList + 1,
          0,
          newId,
        );
        addValidationRules(scheme, payload);
        scheme.options = mergeOptionChanges(
          scheme.options,
          payload.colOptions,
          newId,
        );
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }
  async deleteColumn(server: Server, payload: ConstructorMessage) {
    if (payload.colId !== undefined) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        //return scheme;
        scheme.options.cols[payload.colId] = payload.colOptions;
        const idIndexInList = scheme.options.columnsList.indexOf(payload.colId);
        Object.keys(scheme.headerData).forEach((keyR) => {
          const objList = Object.keys(scheme.headerData[keyR]);
          if (scheme.headerData[keyR][payload.colId]) {
            delete scheme.headerData[keyR][payload.colId];
          } else {
            for (let i = idIndexInList - 1; i >= 0; i--) {
              if (objList.includes(scheme.options.columnsList[i])) {
                scheme.headerData[keyR][
                  scheme.options.columnsList[i]
                ].colSpan -= 1;
                break;
              }
            }
          }
        });
        scheme.options.columnsList.splice(idIndexInList, 1);
        delete scheme.options.cols[payload.colId];
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }

  async editTrigger(server: Server, payload: ConstructorMessage) {
    if (payload.triggerData && payload.triggerIndex !== undefined) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        if (scheme.triggers[payload.triggerIndex]) {
          scheme.triggers[payload.triggerIndex] = payload.triggerData;
          this.sendUpdatedScheme(
            server,
            scheme,
            payload.templateId,
            templateData.schemeId,
            schemeKey,
            true,
          );
        }
      }
    }
  }

  async deleteTrigger(server: Server, payload: ConstructorMessage) {
    if (payload.triggerIndex !== undefined) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        if (scheme.triggers[payload.triggerIndex]) {
          scheme.triggers.splice(payload.triggerIndex, 1);
          this.sendUpdatedScheme(
            server,
            scheme,
            payload.templateId,
            templateData.schemeId,
            schemeKey,
            true,
          );
        }
      }
    }
  }

  async addTrigger(server: Server, payload: ConstructorMessage) {
    if (payload.triggerData) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        if (!scheme.triggers) scheme.triggers = [];
        scheme.triggers.push(payload.triggerData);
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
          true,
        );
      }
    }
  }

  async editCell(server: Server, payload: ConstructorMessage) {
    if (payload.cellOptions && payload.colId && payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      if (templateData && templateData.schemeId) {
        const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
        const scheme: SchemeData = await this.redisService.get(schemeKey);
        if (!scheme.options.customCells[payload.currentRowId])
          scheme.options.customCells[payload.currentRowId] = {};
        scheme.options.customCells[payload.currentRowId][payload.colId] =
          payload.cellOptions;
        addValidationRules(scheme, payload);
        this.sendUpdatedScheme(
          server,
          scheme,
          payload.templateId,
          templateData.schemeId,
          schemeKey,
        );
      }
    }
  }

  async loadTableTemplates(
    templateProjectId: number,
    templateId: number,
    token = '',
  ) {
    try {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + templateId,
      );
      if (templateData) {
        return templateData;
      }
      const host = this.adminServiceHost;
      const data = await firstValueFrom(
        this.httpService
          .get<TableTemplatesResponse>(
            `${host}/api/admin/table-templates/list?limit=1000&templateProjectId=${templateProjectId}`,
            {
              headers: {
                Authorization:
                  'Bearer ' +
                  (token || this.configService.get('ADMIN_SERVICE_TOKEN')),
              },
            },
          )
          .pipe(
            catchError((e) => {
              throw new HttpException(e.response?.data, e.response?.status);
            }),
          ),
      );

      let projectTemplates: ProjectTemplates = await this.redisService.get(
        'projectTemplates',
      );
      if (!projectTemplates) projectTemplates = { [templateProjectId]: [] };
      if (!projectTemplates[templateProjectId])
        projectTemplates[templateProjectId] = [];
      data.data.payload.result?.forEach((template) => {
        projectTemplates[templateProjectId].push(template.id);
        this.redisService.set('tableTemplate' + template.id, template);
        if (template.id === templateId) {
          templateData = template;
        }
      });

      await this.redisService.set('projectTemplates', projectTemplates);
      // this.storeSchemeTable(schemeId, tableId);
      return templateData;
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

  async updateStaticCell(server: Server, payload: ConstructorMessage) {
    if (payload.templateId && payload.newData) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      let tableData: TemplateDataType = JSON.parse(templateData.templateData);
      if (!Array.isArray(tableData)) {
        tableData = convertTemplateData(tableData);
      }
      for (let t in payload.newData) {
        const i = parseInt(t);
        if (tableData[i]) {
          const rowData = payload.newData[t];
          if (typeof rowData === 'object') {
            for (let colKey in rowData) {
              tableData[i][colKey] = rowData[colKey].value;
            }
          }
        }
      }
      templateData.templateData = JSON.stringify(tableData);

      await this.redisService.set(
        'tableTemplate' + payload.templateId,
        templateData,
      );
      server
        .to('templateTableRoom' + payload.templateId)
        .emit('updateStaticData', tableData);
    }
  }

  async sendUpdatedData(server: Server, payload: ConstructorMessage) {
    let templateData: TableTemplateType = await this.redisService.get(
      'tableTemplate' + payload.templateId,
    );
    const schemeKey = 'schemeOptionConstructor' + templateData.schemeId;
    const newScheme: SchemeData = await this.redisService.get(schemeKey);
    if (templateData) {
      let tableData: TemplateDataType = null;
      tableData = JSON.parse(templateData.templateData);

      tableData.forEach((t, i) => {
        if (!t._id) tableData[i]._id = ObjectId();
      });
      templateData.templateData = JSON.stringify(tableData);

      const newTemplateData: IBodyData = Array.isArray(tableData)
        ? convertTemplateData2(tableData)
        : tableData;

      // let scheme = await this.redisService.get<SchemeData>(
      //   'schemeOption' + templateData.schemeId,
      // );
      // if (scheme) {

      const data = await this.saveTemplateChanges(
        payload?.templateId,
        templateData,
        newTemplateData,
        payload.token,
      );

      this.sendUpdatedDataToActiveUsers(
        server,
        tableData,
        payload.templateId,
        newScheme,
        payload.token,
      );

      if (newScheme) {
        this.redisService.set(
          'schemeOption' + templateData.schemeId,
          newScheme,
        );
        this.schemeService.saveScheme(templateData.schemeId, newScheme);
      }
    }
  }

  async saveTemplateChanges(
    templateId: number,
    templateData: TableTemplateType,
    newTemplateData: IBodyData,
    token?: string,
  ) {
    const host = this.adminServiceHost;
    token =
      'Bearer ' + (token || this.configService.get('ADMIN_SERVICE_TOKEN'));
    const data = {
      templateData: JSON.stringify(newTemplateData),
      description: templateData.description,
      legend: templateData.legend,
      name: templateData.name,
      schemeId: templateData.schemeId,
      prefilling: templateData.prefilling,
      type: templateData.type,
      plugin: templateData.plugin,
    };
    const response = await firstValueFrom(
      this.httpService
        .put(`${host}/api/admin/table-templates/${templateId}`, data, {
          headers: {
            Authorization: token,
          },
        })
        .pipe(
          catchError((e) => {
            console.log(e);
            throw new HttpException(e.response?.data, e.response?.status);
          }),
        ),
    );
    return response.data;
  }

  async sendUpdatedDataToActiveUsers(
    server: Server,
    tableStaticData: TemplateDataType | null,
    templateId: number,
    scheme: SchemeData,
    token: string,
  ) {
    const tablesList = await this.getTemplateTables(templateId, token);
    if (!tablesList || !scheme) return;

    const updatedOptionsData = {
      triggers: scheme.triggers,
      options: scheme.options,
      headerData: transformHeader(scheme.headerData),
    };

    for (let tableId of tablesList) {
      server
        .to('tableRoom' + tableId)
        .emit('updateOptions', updatedOptionsData);
      if (!tableStaticData) continue;
      const tableData: IBodyData = await this.redisService.get(
        'dataTable' + tableId,
      );
      if (!tableData) continue;

      tableStaticData.forEach((rowData, i) => {
        const key = Object.keys(tableData).find(
          (t) => tableData[t].rowIndex === i,
        );
        if (key) {
          Object.keys(rowData).forEach((rowKey) => {
            if (rowKey !== '_id' && tableData[key][rowKey]) {
              tableData[key][rowKey].value = rowData[rowKey];
            }
          });
        }
      });
      await this.redisService.set('dataTable' + tableId, tableData);
      server.to('tableRoom' + tableId).emit('updatedTable', {
        newData: dataSorterArray(tableData, scheme.options.columnsList || []),
      });
    }
  }

  async showAlertMessage(server: Server, payload: ConstructorMessage) {
    if (payload.templatesList && payload.alertMessage) {
      for (let templateId of payload.templatesList) {
        const tablesList = await this.getTemplateTables(
          templateId,
          payload.token,
        );
        if (!tablesList) return;

        for (let tableId of tablesList) {
          server
            .to('tableRoom' + tableId)
            .emit('alertMessage', { message: payload.alertMessage });
        }
      }
    }
  }

  async getTemplateTables(templateId: number, token = ''): Promise<number[]> {
    const host = this.host;
    token = 'Bearer ' + token;
    const data = await firstValueFrom(
      this.httpService
        .get<TableTemplateListRequestResponse>(
          `${host}/api/table-engine/tables/list?templateTableId=${templateId}`,
          {
            headers: {
              Authorization: token,
            },
          },
        )
        .pipe(
          catchError((e) => {
            console.log(e.response);
            throw new HttpException(e.response.data, e.response.status);
          }),
        ),
    );
    return data.data.payload.result.map((t) => t.id);
  }

  async addRow(server: Server, payload: ConstructorMessage) {
    if (payload.templateId && payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      let tableData: TemplateDataType = JSON.parse(templateData.templateData);
      if (!Array.isArray(tableData)) {
        tableData = convertTemplateData(tableData);
      }
      const j = parseInt(payload.currentRowId) + (payload.before ? 0 : 1);
      const newRow = {};
      tableData.splice(j, 0, newRow);
      templateData.templateData = JSON.stringify(tableData);

      await this.redisService.set(
        'tableTemplate' + payload.templateId,
        templateData,
      );

      // let scheme = await this.redisService.get<SchemeData>(
      //   'schemeOption' + templateData.schemeId,
      // );
      // if (scheme) {
      server
        .to('templateTableRoom' + payload.templateId)
        .emit('updateStaticData', tableData);
    }
  }

  async deleteRow(server: Server, payload: ConstructorMessage) {
    if (payload.templateId && payload.currentRowId) {
      let templateData: TableTemplateType = await this.redisService.get(
        'tableTemplate' + payload.templateId,
      );
      let tableData: TemplateDataType = JSON.parse(templateData.templateData);
      if (!Array.isArray(tableData)) {
        tableData = convertTemplateData(tableData);
      }
      const j = parseInt(payload.currentRowId);
      tableData.splice(j, 1);
      templateData.templateData = JSON.stringify(tableData);
      await this.redisService.set(
        'tableTemplate' + payload.templateId,
        templateData,
      );

      // let scheme = await this.redisService.get<SchemeData>(
      //   'schemeOption' + templateData.schemeId,
      // );
      // if (scheme) {
      server
        .to('templateTableRoom' + payload.templateId)
        .emit('updateStaticData', tableData);
    }
  }
}
