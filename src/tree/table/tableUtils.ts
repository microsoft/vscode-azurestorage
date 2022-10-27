import * as azureDataTables from '@azure/data-tables';
import { maxPageSize } from '../../constants';

export async function listAllTables(tableServiceClientFactory: () => azureDataTables.TableServiceClient): Promise<azureDataTables.TableItem[]> {
    let response: azureDataTables.TableItemResultPage | undefined;

    const queues: azureDataTables.TableItem[] = [];

    do {
        response = await listTables(tableServiceClientFactory, response?.continuationToken);

        if (response) {
            queues.push(...response);
        }
    } while (response.continuationToken);

    return queues;
}

export async function listTables(tableServiceClientFactory: () => azureDataTables.TableServiceClient, continuationToken?: string): Promise<azureDataTables.TableItemResultPage> {
    const tableServiceClient = tableServiceClientFactory();
    const response: AsyncIterableIterator<azureDataTables.TableItemResultPage> = tableServiceClient.listTables().byPage({ continuationToken, maxPageSize });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (await response.next()).value;
}
