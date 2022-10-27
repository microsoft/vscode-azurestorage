import * as azureStorageQueue from '@azure/storage-queue';
import { maxPageSize } from '../../constants';
import { IStorageRoot } from '../IStorageRoot';

export async function listAllQueues(storageRoot: IStorageRoot): Promise<azureStorageQueue.QueueItem[]> {
    let response: azureStorageQueue.ListQueuesSegmentResponse | undefined;

    const queues: azureStorageQueue.QueueItem[] = [];

    do {
        response = await listQueues(storageRoot, response?.continuationToken);

        if (response.queueItems) {
            queues.push(...response.queueItems);
        }
    } while (response.continuationToken);

    return queues;
}

export async function listQueues(storageRoot: IStorageRoot, continuationToken?: string): Promise<azureStorageQueue.ListQueuesSegmentResponse> {
    const queueServiceClient = storageRoot.createQueueServiceClient();
    const response: AsyncIterableIterator<azureStorageQueue.ServiceListQueuesSegmentResponse> = queueServiceClient.listQueues().byPage({ continuationToken, maxPageSize });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (await response.next()).value;
}
