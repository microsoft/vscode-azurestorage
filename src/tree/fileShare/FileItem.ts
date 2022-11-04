import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
import { createFileClient } from '../../utils/fileUtils';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from '../StorageAccountModel';

export class FileItem implements StorageAccountModel {
    constructor(
        private readonly path: string,
        private readonly shareName: string,
        private readonly storageRoot: IStorageRoot) {
    }

    get copyUrl(): vscode.Uri {
        const directoryPath = path.dirname(this.path);
        const fileName = path.basename(this.path);
        const fileClient: azureStorageShare.ShareFileClient = createFileClient(this.storageRoot, this.shareName, directoryPath !== '.' ? directoryPath : '' , fileName);

        return vscode.Uri.parse(fileClient.url);
    }

    getChildren(): vscode.ProviderResult < StorageAccountModel[] > {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(path.basename(this.path));

        treeItem.contextValue = 'azureFile';
        treeItem.iconPath = new vscode.ThemeIcon('file');

        return treeItem;
    }
}
