import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";

export interface IDeleteBlobDirectoryWizardContext extends IActionContext, ExecuteActivityContext {
    dirName?: string
    blobDirectory?: BlobDirectoryTreeItem
    suppress?: boolean;
}
