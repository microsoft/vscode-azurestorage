import { IActionContext } from "@microsoft/vscode-azext-utils";

export interface IExistingFileContext extends IActionContext {
    localFilePath: string;
    remoteFilePath: string;
}
