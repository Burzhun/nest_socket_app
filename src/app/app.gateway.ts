import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { AppService } from 'src/app/app.service';
import {
  CustomCells,
  IBodyData,
  IChanges,
  IData,
  IOptionsData,
  NewTriggerCells,
  ProjectSaveDataType,
  ProjectStore,
  SchemeData,
  UpdateMessagePayload,
  IHeaderData,
  NewTriggers,
  TriggerCells,
  TableStore,
  ConstructorMessage,
  ExcelFileResponse,
} from 'src/types';
import { Cron } from '@nestjs/schedule';
import { CellBlocks } from 'src/types';
import { checkValidators } from 'src/validation';

import {
  addRow,
  blocksTransform,
  changedData,
  dataSorterArray,
  dataTransform,
  deleteRow,
  duplicateRow,
  transformHeader,
} from 'src/app/dataTransformers';
import { mergeTableChanges } from 'src/mergeTableChanges';
import { SchemeService } from '../scheme/scheme.sevice';
import { RedisService } from 'src/redis/redis.service';
import { TableService } from 'src/table/table.service';
import { TriggerService } from 'src/triggers/trigger.service';
import { ConstructorService } from 'src/constructor/constructor.service';
//import { SchedulerRegistry } from '@nestjs/schedule';

type TableData = {
  changes: any[];
  data: any[];
  blocks: CellBlocks;
  bodyData: IData;
};

@WebSocketGateway(5001, { cors: true })
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private redisService: RedisService,
    private readonly appService: AppService, //private schedulerRegistry: SchedulerRegistry,
    private readonly tableService: TableService,
    private readonly schemeService: SchemeService,
    private readonly triggerService: TriggerService,
    private readonly constructorService: ConstructorService,
  ) {}
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('AppGateway');

  @Cron('0 */1 * * * *')
  handleCron() {
    this.logger.debug('Called when the current second is 45');
    // this.cronTableSave();
  }

  async cronTableSave() {
    const projectStore: ProjectStore =
      (await this.redisService.get('projectStore')) || {};
    if (projectStore) {
      for (const projectId in projectStore) {
        const tables = projectStore[projectId];
        if (tables.length) {
          const projectData: ProjectSaveDataType = { tables: [] };
          for (const t of tables) {
            const changes: IChanges = await this.redisService.get(
              'changes' + t.tableId,
            );
            if (changes && Object.keys(changes).length) {
              let bodyData: IBodyData = await this.redisService.get(
                'dataTable' + t.tableId,
              );
              bodyData = changedData(bodyData, changes);
              projectData.tables.push({
                data: bodyData,
                tableId: t.tableId,
              });
            }
          }
          this.logger.log('saving');
          try {
            await this.tableService.saveProject(projectId, projectData);
          } catch {
            console.log('error saving project ' + projectId);
          }
        }
      }
    }
  }

  @SubscribeMessage('constructorMessage')
  async constrsuctorMessage(client: Socket, payload: ConstructorMessage) {
    this.constructorService.updateMessage(this.server, payload);
  }

  @SubscribeMessage('updateMessage')
  async updateMessage(
    client: Socket,
    payload: UpdateMessagePayload,
  ): Promise<void> {
    // console.log(payload.data, 'update');
    const userId = client.handshake.query.token.toString();
    this.handleUpdateMessage(payload, userId);
  }

  async handleUpdateMessage(payload: UpdateMessagePayload, userId: string) {
    const tableData: IBodyData = await this.redisService.get(
      'dataTable' + payload?.tableId,
    );

    let oldChanges: IChanges = await this.redisService.get(
      'changes' + payload?.tableId,
    );
    const triggerCells: NewTriggerCells = await this.redisService.get(
      'triggerCells' + payload?.tableId,
    );
    if (!tableData) return;
    if (tableData && !oldChanges) {
      this.redisService.set('changes' + payload?.tableId, {});
      oldChanges = {};
    }
    //  let options = {} as IOptionsData;
    const scheme: SchemeData = await this.tableService.getScheme(
      payload.tableId,
    );
    const { blocks, changes } = await checkValidators(
      scheme,
      this.redisService,
      payload,
      userId,
    );

    let isTriggeredCell = false;

    for (const keyR in changes) {
      for (const keyC in changes[keyR]) {
        if (keyR in triggerCells && keyC in triggerCells[keyR])
          isTriggeredCell = true;
        break;
      }
    }

    if (isTriggeredCell) {
      //options = await this.cacheManager.get('options' + payload?.tableId);
    }

    const { tableChanges, otherTableChanges } =
      await this.triggerService.updateTriggers(
        changes as IChanges,
        triggerCells,
        scheme.triggers || [],
        payload.tableId,
        oldChanges,
        tableData,
        userId,
        (formula, paramters) => {
          return this.appService.getFormulaValue(formula, paramters);
        },
      );

    const updatedChanges = mergeTableChanges(oldChanges, tableChanges);
    const response = {};
    const summaryValues = this.triggerService.checkSummaryValues(
      updatedChanges,
      tableData,
      triggerCells,
      scheme.options,
    );

    if (summaryValues && Object.keys(summaryValues).length) {
      response['summaryValues'] = summaryValues;
    }

    response['blocks'] = blocksTransform(blocks, tableData);
    if (tableChanges && Object.keys(tableChanges).length) {
      response['changes'] = dataTransform<IChanges>(tableChanges, tableData);
    }

    const newCustomCells: CustomCells =
      this.triggerService.checkConditionTriggers(
        tableData,
        updatedChanges,
        triggerCells,
        scheme.triggers,
      );

    if (newCustomCells && Object.keys(newCustomCells).length) {
      scheme.options.customCells = this.triggerService.setCustomCells(
        scheme.options.customCells,
        newCustomCells,
      );

      this.redisService
        .set('options' + payload?.tableId, scheme.options)
        .catch((e) => {
          console.log(e);
        });

      response['newCustomCells'] = newCustomCells;
    }

    this.server
      .to('tableRoom' + payload?.tableId)
      .emit('msgToClient', response);

    this.redisService
      .set('changes' + payload?.tableId?.toString(), updatedChanges)
      .catch((e) => {
        console.log(e);
      });
    this.redisService
      .set('blocks' + payload?.tableId?.toString(), blocks)
      .catch((e) => {
        console.log(e);
      });

    if (otherTableChanges) {
      Object.keys(otherTableChanges).forEach((tableIdKey) => {
        this.handleUpdateMessage(
          {
            data: otherTableChanges[tableIdKey],
            tableId: parseInt(tableIdKey),
          },
          userId,
        );
      });
    }
  }

  @SubscribeMessage('loadTableV2')
  async handleNewTableLoad(
    client: Socket,
    payload: { tableId: string; projectId: number },
  ): Promise<void> {
    const rooms = Array.from(client.rooms);
    if (rooms.length > 1) {
      rooms.forEach((r) => {
        if (r.startsWith('tableRoom')) client.leave(r);
      });
    } else {
      client.join('projectRoom' + payload?.projectId);
    }
    client.join('tableRoom' + payload?.tableId);

    const tableId = payload?.tableId;
    const projectId = payload?.projectId;

    let tableStore = await this.redisService.get<TableStore>('tablesState');
    let tableData: IBodyData = null;
    let scheme: SchemeData = null;
    let loadProjectTables = true;
    const changes: IChanges =
      (await this.redisService.get('changes' + tableId)) || {};
    let triggerCells: TriggerCells = {};

    if (tableStore && tableStore[tableId]) {
      tableData = await this.redisService.get<IBodyData>(
        tableStore[tableId].dataKey,
      );
      scheme = await this.redisService.get<SchemeData>(
        tableStore[tableId].schemeKey,
      );
      if (tableData && scheme) {
        loadProjectTables = false;
        tableData = changedData(tableData, changes);
      }
    }
    try {
      if (loadProjectTables) {
        [tableStore, tableData, scheme] = await this.appService.loadTable(
          tableStore,
          projectId,
          +tableId,
        );
      }
      triggerCells = await this.appService.setTableData(
        +tableId,
        tableData,
        scheme,
      );
    } catch (e) {
      console.log(e);
      client.emit('error', {
        errorMessage: 'Не удалось загрузить проект',
      });
      return;
    }

    const blocks = (await this.redisService.get('blocks' + tableId)) || {};

    const summaryValues = this.triggerService.checkSummaryValues(
      changes,
      tableData,
      triggerCells,
      scheme.options,
    );

    client.emit('generateGridData', {
      options: scheme.options,
      useFilters: scheme.useFilters,
      triggers: scheme.triggers,
      header2: transformHeader(scheme.headerData),
      bodyData: dataSorterArray(tableData, scheme.options.columnsList),
      // bodyData2: prepareDataToSave(tableData.bodyData),
      // bodyData3: convertLoadedData(prepareDataToSave(tableData.bodyData)),
      blocks: blocksTransform(blocks, tableData),
      summaryValues:
        summaryValues && Object.keys(summaryValues).length
          ? summaryValues
          : undefined,
    });

    if (loadProjectTables)
      this.appService.loadProjectData(projectId, +tableId, tableStore);
  }

  @SubscribeMessage('loadAdminTable')
  async handleAdminTableLoad(
    client: Socket,
    payload: { token: string; templateProjectId: number; templateId: number },
  ): Promise<void> {
    // const rooms = Array.from(client.rooms);
    // if (rooms.length > 1) {
    //   rooms.forEach((r) => {
    //     if (r.startsWith('tableRoom')) client.leave(r);
    //   });
    // } else {
    //   client.join('projectRoom' + payload?.projectId);
    // }
    client.join('templateTableRoom' + payload?.templateId);

    //const templateTableId = payload?.templateTableId;

    let tableData: IBodyData = null;
    let scheme: SchemeData = null;
    const changes: IChanges = {};
    let triggerCells: TriggerCells = {};

    tableData = {};
    const tableTemplate = await this.constructorService.loadTableTemplates(
      payload.templateProjectId,
      payload.templateId,
      payload.token,
    );
    if (!tableTemplate) {
      console.log('error');
      client.emit('error', {
        errorMessage: 'Не удалось загрузить проект',
      });
      return;
    }
    scheme = await this.schemeService.getAdminScheme(tableTemplate.schemeId);

    const templateData = JSON.parse(tableTemplate.templateData);

    const summaryValues = this.triggerService.checkSummaryValues(
      changes,
      tableData,
      triggerCells,
      scheme.options,
    );

    client.emit('generateGridData', {
      options: scheme.options,
      triggers: scheme.triggers,
      header2: transformHeader(scheme.headerData),
      bodyData: dataSorterArray(
        templateData,
        scheme.options?.columnsList || [],
      ),
      // bodyData2: prepareDataToSave(tableData.bodyData),
      // bodyData3: convertLoadedData(prepareDataToSave(tableData.bodyData)),
      blocks: {},
      summaryValues:
        summaryValues && Object.keys(summaryValues).length
          ? summaryValues
          : undefined,
    });
  }

  async sendReloadedData(tableId, projectId) {
    let tableStore = await this.redisService.get<TableStore>('tablesState');
    let tableData: IBodyData = null;
    let scheme: SchemeData = null;

    [tableStore, tableData, scheme] = await this.appService.loadTable(
      tableStore,
      projectId,
      +tableId,
    );

    const triggerCells: TriggerCells =
      (await this.redisService.get('triggerCells' + tableId)) || {};

    const summaryValues = this.triggerService.checkSummaryValues(
      {},
      tableData,
      triggerCells,
      scheme.options,
    );

    this.server.to('tableRoom' + tableId).emit('reloadTable', {
      data: dataSorterArray(tableData, scheme.options.columnsList),
      options: tableData.options,
      triggers: scheme.triggers,
      header: transformHeader(scheme.headerData),
      blocks: blocksTransform(tableData.blocks, tableData),
      summaryValues:
        summaryValues && Object.keys(summaryValues).length
          ? summaryValues
          : undefined,
    });

    this.server.to('tableRoom' + tableId).emit('needMessage', {
      message: 'Данные сохранены',
      type: 'error',
    });
  }

  @SubscribeMessage('blockMessage')
  async handleCellBlock(client: Socket, payload: any): Promise<void> {
    const tableData: IBodyData = await this.redisService.get(
      'dataTable' + payload?.tableId,
    );
    const socketId = client.id;
    const blockedData: TableData = await this.redisService.get(
      'blocks' + payload?.tableId?.toString(),
    );

    if (blockedData) {
      if (!blockedData[socketId]) blockedData[socketId] = [];
      blockedData[socketId] = payload.data;
      this.redisService.set(
        'blocks' + payload?.tableId?.toString(),
        blockedData,
      );

      this.server.to('tableRoom' + payload?.tableId).emit('msgToClient', {
        blocks: blocksTransform(blockedData, tableData),
      });
    }
  }

  @SubscribeMessage('unblock')
  async unblockMessage(client: Socket, payload: any): Promise<void> {
    const tableData: IBodyData = await this.redisService.get(
      'dataTable' + payload?.tableId,
    );
    const socketId = client.id;
    const blockedData: TableData = await this.redisService.get(
      'blocks' + payload?.tableId?.toString(),
    );

    if (blockedData) {
      if (blockedData[socketId]) delete blockedData[socketId];
      this.redisService.set(
        'blocks' + payload?.tableId?.toString(),
        blockedData,
      );

      this.server.to('tableRoom' + payload?.tableId).emit('msgToClient', {
        blocks: blocksTransform(blockedData, tableData),
      });
    } else {
      this.server.to('tableRoom' + payload?.tableId).emit('msgToClient', {
        blocks: {},
      });
    }
  }

  afterInit() {
    //this.logger.log('Init');
  }

  async saveProject(projectId: string, clearData = false) {
    const tablesList = await this.appService.getTablesList(projectId);
    if (tablesList.length) {
      const projectData: ProjectSaveDataType = { tables: [] };
      for (const t of tablesList) {
        const changes: IChanges = await this.redisService.get(
          'changes' + t.tableId,
        );
        if (changes && Object.keys(changes).length) {
          let bodyData: IBodyData = await this.redisService.get(
            'dataTable' + t.tableId,
          );
          bodyData = changedData(bodyData, changes);
          projectData.tables.push({
            data: bodyData,
            tableId: t.tableId,
          });
        }
      }

      try {
        await this.tableService.saveProject(projectId, projectData);
      } catch (e) {
        this.logger.log(e.message);
      }

      await this.appService.deleteProjectTables(projectId, clearData);
    }
  }

  @SubscribeMessage('addRow')
  async handleAddRow(client: Socket, payload: any): Promise<void> {
    const addBefore: boolean = payload.before;
    const newData = await this.tableService.editRows(
      addBefore ? 'addBefore' : 'add',
      payload.tableId,
      payload.currentRowId,
    );
    this.server.to('tableRoom' + payload?.tableId).emit('updatedTable', {
      newData: newData,
    });
  }

  @SubscribeMessage('deleteRow')
  async handleDeleteRow(client: Socket, payload: any): Promise<void> {
    const newData = await this.tableService.editRows(
      'delete',
      payload.tableId,
      payload.currentRowId,
    );
    this.server.to('tableRoom' + payload?.tableId).emit('updatedTable', {
      newData: newData,
    });
  }

  @SubscribeMessage('duplicateRow')
  async handleDuplicateRow(client: Socket, payload: any): Promise<void> {
    const newData = await this.tableService.editRows(
      'duplicate',
      payload.tableId,
      payload.currentRowId,
    );
    this.server.to('tableRoom' + payload?.tableId).emit('updatedTable', {
      newData: newData,
    });
  }

  @SubscribeMessage('exportProject')
  async exportProject(
    client: Socket,
    payload: { projectId: number; fileType: string },
  ): Promise<void> {
    const response: ExcelFileResponse | undefined =
      await this.tableService.getPdfExcel(
        payload.projectId,
        payload.fileType === 'pdf',
      );
    if (response?.data.status === 'success') {
      client.emit('fileResponse', {
        data: response.data.payload,
        fileType: payload.fileType,
      });
    } else {
      client.emit('fileResponse', {
        data: 'error',
        fileType: payload.fileType,
      });
    }
    // this.saveProject(payload.projectId.toString());
    // client.emit('projectSaved', {});
  }

  async handleDisconnect() {
    this.logger.log('Disconnect');
  }

  roomLeave(projectId: string) {
    this.logger.log('Project room Left ' + projectId);
    this.saveProject(projectId, true);
  }

  async userDisconnect(client: Socket, projectId: string, tableId: string) {
    const socketId = client.id;
    this.logger.log(client.rooms);

    const blocks: TableData = await this.redisService.get('blocks' + tableId);
    if (blocks) {
      if (socketId in blocks) {
        delete blocks[socketId];

        this.server.to('tableRoom' + tableId).emit('msgToClient', {
          blocks: blocksTransform(blocks),
          // tableId: parseInt(tableId),
        });

        this.redisService.set('blocks' + tableId?.toString(), blocks);
      }
    }
    setTimeout(async () => {
      const roomUsers = await this.server
        .in('projectRoom' + projectId)
        .fetchSockets();
      this.logger.log('users timeout', Array.from(roomUsers).length);
      if (Array.from(roomUsers).length === 0) {
        this.roomLeave(projectId);
      }
    }, 2000);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.on('disconnecting', () => {
      const rooms = Array.from(client.rooms);
      this.logger.log(`Client disconnected: ${client.id}`, rooms.length);
      if (rooms.length === 3) {
        const projectId = rooms[1].replace('projectRoom', '');
        const tableId = rooms[2].replace('tableRoom', '');
        this.userDisconnect(client, projectId, tableId);
      }

      this.logger.log(`DISCONNECTING: ${Array.from(client.rooms)}`); // Set { ... }
    });
  }
}
