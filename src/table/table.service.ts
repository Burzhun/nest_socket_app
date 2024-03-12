import { HttpException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios/dist';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

import {
  ExcelFileResponse,
  ExcelPdfRequest,
  ExcelPdfTableRequest,
  IBodyData,
  IChanges,
  IOptionsData,
  ProjectSaveDataType,
  ProjectSaveResponse,
  ProjectStore,
  RowRequestType,
  SchemeData,
  TableDataList,
  TableListRequestResponse,
  TableRequestResponse,
  TableSaveResponse,
  TableStore,
  TableTemplateType,
} from '../types';
import { AxiosResponse } from 'axios';
import { RedisService } from 'src/redis/redis.service';
import {
  addRow,
  changedData,
  dataSorterArray,
  deleteRow,
  duplicateRow,
} from 'src/app/dataTransformers';
import { SchemeService } from 'src/scheme/scheme.sevice';

@Injectable()
export class TableService {
  private host: string;
  private token: string;

  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
    private redisService: RedisService,
    private schemeService: SchemeService,
  ) {
    this.host = this.configService.get('SERVER_HOST');
    this.token = this.configService.get('TOKEN');
  }

  private logger: Logger = new Logger('AppGateway');

  async getTable(
    projectId,
    tableId,
  ): Promise<AxiosResponse<TableRequestResponse, any> | undefined> {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    try {
      const data = firstValueFrom(
        this.httpService
          .get<TableRequestResponse>(
            `${host}/api/table-engine/project/${projectId}/tables/${tableId}`,
            {
              headers: {
                Authorization: token,
              },
            },
          )
          .pipe(
            catchError((e) => {
              throw new HttpException(e.response?.data, e.response?.status);
            }),
          ),
      );
      this.logger.log('loaded');

      return data;
    } catch {
      return undefined;
    }
  }

  async saveTable(tableId: number, data: IBodyData) {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    const response = firstValueFrom(
      this.httpService
        .post<TableSaveResponse>(
          `${host}/api/table-engine/table/${tableId}/create-version`,
          { data },
          {
            headers: {
              Authorization: token,
            },
          },
        )
        .pipe(
          catchError((e) => {
            throw new HttpException(e.response.data, e.response.status);
          }),
        ),
    );
    return response;
  }

  async saveProject(projectId: string, data: ProjectSaveDataType) {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    if (data.tables && data.tables.length) {
      try {
        const response = firstValueFrom(
          this.httpService.post<ProjectSaveResponse>(
            `${host}/api/table-engine/project/${projectId}/create-version`,
            data,
            {
              headers: {
                Authorization: token,
              },
            },
          ),
        );
        return response;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  async getProject(projectId) {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    const data = firstValueFrom(
      this.httpService
        .get(`${host}/api/project/${projectId}`, {
          headers: {
            Authorization: token,
          },
        })
        .pipe(
          catchError((e) => {
            throw new HttpException(e.response.data, e.response.status);
          }),
        ),
    );
    return data;
  }

  async loadTablesList(projectId: string) {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    const data = firstValueFrom(
      this.httpService
        .get<TableListRequestResponse>(
          `${host}/api/table-engine/project/${projectId}/tables/repr/list`,
          {
            headers: {
              Authorization: token,
            },
          },
        )
        .pipe(
          catchError((e) => {
            throw new HttpException(e.response.data, e.response.status);
          }),
        ),
    );
    return data;
  }

  async getScheme(tableId: number | string) {
    const tableStore = await this.redisService.get<TableStore>('tablesState');
    if (tableStore && tableStore[tableId]) {
      const scheme: SchemeData = await this.redisService.get(
        tableStore[tableId].schemeKey,
      );
      if (!scheme) {
        const scheme1 = await this.schemeService.getScheme(
          tableStore[tableId].schemeId,
        );
        return scheme1;
      }

      return scheme;
    }
    return null;
  }

  async editRows(
    requestType: RowRequestType,
    tableId: string,
    insertRowId: string,
  ): Promise<TableDataList> {
    const tableData: IBodyData = await this.redisService.get(
      'dataTable' + tableId,
    );
    const changes: IChanges = await this.redisService.get('changes' + tableId);
    const options: IOptionsData = (await this.getScheme(tableId)).options;
    const changedTableData = changedData(tableData, changes);
    let newData = changedTableData;
    switch (requestType) {
      case 'add':
        newData = addRow(changedTableData, insertRowId, false);
        break;
      case 'addBefore':
        newData = addRow(changedTableData, insertRowId, true);
        break;
      case 'delete':
        newData = deleteRow(changedTableData, insertRowId);
        break;
      case 'duplicate':
        newData = duplicateRow(changedTableData, insertRowId);
        break;
    }
    await this.redisService.set('dataTable' + tableId, newData);
    return dataSorterArray(newData, options.columnsList);
  }

  async getPdfExcel(projectId: number, isPdf = false) {
    const projectData = await this.getProject(projectId);
    const requestData: ExcelPdfRequest = {
      id: projectData.data.payload.id,
      name: projectData.data.payload.name,
      plugin: 'table',
      tables: [],
    };
    const tablesList = await this.loadTablesList(projectId.toString());
    let i = 1;
    for (const t of tablesList.data.payload) {
      const tableData: IBodyData = await this.redisService.get(
        'dataTable' + t.id,
      );
      const scheme = await this.getScheme(t.id);
      // if (!tableData || !scheme) console.log("!T "+t.id)
      if (!tableData || !scheme) continue;

      const tableRequestData: ExcelPdfTableRequest = {
        id: t.id,
        name: t.title,
        number: i,
        data: {
          rows: {},
        },
        options: {
          columns: [],
          header: {
            rows: [],
          },
        },
      };
      const columnsList = scheme.options.columnsList;
      Object.keys(tableData).forEach((key) => {
        const cells = {};
        columnsList.forEach((column) => {
          let value: string | number = tableData[key][column]
            ? tableData[key][column].value?.toString() || ''
            : '';
          if (
            tableData[key][column] &&
            scheme.options.cols[column] &&
            scheme.options.cols[column].type?.includes('select')
          ) {
            value = tableData[key][column].selected?.value;
          }
          //if(scheme.options.cols[column] && scheme.options.cols[column].type==='ninput') value = value
          cells[column] = { value };
        });
        tableRequestData.data.rows[key] = {
          orderIndex: tableData[key].rowIndex,
          cells,
        };
      });

      const headerKeys = Object.keys(scheme.headerData);
      headerKeys.sort(
        (a, b) => scheme.headerData[a].rowIndex - scheme.headerData[b].rowIndex,
      );
      headerKeys.forEach((key, i) => {
        const headerRow = {
          height: 50,
          columns: [],
        };
        columnsList.forEach((k) => {
          if (k === 'rowIndex' || !scheme.headerData[key][k]) return;
          const colSpan = scheme.headerData[key][k].colSpan || 1;
          headerRow.columns.push({
            title: scheme.headerData[key][k].value,
            width: colSpan * 100,
            cells: colSpan * 1,
          });
        });
        tableRequestData.options.header.rows.push(headerRow);
      });
      tableRequestData.options.columns = columnsList.map((t) => {
        const col = scheme.options.cols[t];
        return {
          key: t,
          type: col && col.type === 'ninput' ? 'float' : 'string',
        };
      });
      requestData.tables.push(tableRequestData);
    }
    if (isPdf) {
      try {
        const signData = await this.loadSignData(projectId);
        requestData.signerData = signData.data.payload;
      } catch {
        return {
          data: {
            status: 'error',
            payload: '',
          },
        };
      }
    }
    await this.redisService.set('test', requestData);
    try {
      const fileData: ExcelFileResponse = await this.loadExcelPdf(
        requestData,
        isPdf,
      );
      return fileData;
    } catch (e) {
      console.log(e);
      return undefined;
    }
  }

  async loadExcelPdf(requestData: ExcelPdfRequest, isPdf: boolean) {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    const type = isPdf ? 'pdf' : 'excel';
    if (requestData && requestData.tables.length) {
      try {
        const response = firstValueFrom(
          this.httpService.post(
            `http://10.50.10.79:8089/api/v1/export/${type}`,
            requestData,
            {
              headers: {
                Authorization: token,
              },
            },
          ),
        );
        return response;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  async loadSignData(projectId: number) {
    const host = this.host;
    const token = 'Bearer ' + this.token;
    if (projectId) {
      try {
        const response = firstValueFrom(
          this.httpService.get(
            `http://10.50.10.79:8089/api/project/${projectId}/sign`,
            {
              headers: {
                Authorization: token,
              },
            },
          ),
        );
        return response;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
