import { Controller, Post, Body, Query } from '@nestjs/common';
import { IBodyData, IChanges, ProjectStore, ReloadTablesList } from './types';
import { AppGateway } from './app/app.gateway';
import { changedData } from './app/dataTransformers';
import { RedisService } from './redis/redis.service';
import { TableService } from './table/table.service';

@Controller()
export class AppController {
  constructor(
    private readonly tableService: TableService,
    private readonly appGateway: AppGateway,
    private redisService: RedisService,
  ) {}

  @Post('/api/table-engine/reload-tables')
  async getTable(
    @Body() tablesList: ReloadTablesList,
    @Query('saved') saved,
  ): Promise<string> {
    try {
      if (tablesList?.tableIds?.length) {
        const projectStore: ProjectStore =
          (await this.redisService.get('projectStore')) || {};
        for (const tableId of tablesList?.tableIds) {
          const projectId = Object.keys(projectStore).find((k) =>
            projectStore[k].find((s) => s.tableId === tableId),
          );
          if (projectId) {
            if (saved) {
              const changes: IChanges = await this.redisService.get(
                'changes' + tableId,
              );
              if (changes && Object.keys(changes).length) {
                const bodyData: IBodyData = await this.redisService.get(
                  'dataTable' + tableId,
                );
                await this.tableService.saveTable(
                  tableId,
                  changedData(bodyData, changes),
                );
              }
            }

            this.appGateway.sendReloadedData(tableId, projectId);
          }
        }
      }
    } catch (e) {
      return e.message;
    }
    //this.appGateway.
    return 'ok';
  }
}
