import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { Uri } from "vscode";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { IAzCopyResolution } from "../azCopy/IAzCopyResolution";

export interface IUploadFolderWizardContext extends IActionContext, ExecuteActivityContext {
    calledFromUploadToAzureStorage: boolean;
    destinationDirectory?: string;
    resolution?: IAzCopyResolution;
    treeItem?: BlobContainerTreeItem | FileShareTreeItem;
    uri?: Uri;
}
