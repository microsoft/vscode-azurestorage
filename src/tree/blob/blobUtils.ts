import * as azureStorageBlob from "@azure/storage-blob";
import { maxPageSize } from '../../constants';

export async function listAllContainers(blobServiceClient: azureStorageBlob.BlobServiceClient): Promise<azureStorageBlob.ContainerItem[]> {
    let response: azureStorageBlob.ListContainersSegmentResponse | undefined;

    const containers: azureStorageBlob.ContainerItem[] = [];

    do {
        response = await listContainers(blobServiceClient, response?.continuationToken);

        if (response.containerItems) {
            containers.push(...response.containerItems);
        }
    } while (response.continuationToken);

    return containers;
}

export async function listContainers(blobServiceClient: azureStorageBlob.BlobServiceClient, continuationToken?: string): Promise<azureStorageBlob.ListContainersSegmentResponse> {
    const response: AsyncIterableIterator<azureStorageBlob.ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (await response.next()).value;
}
