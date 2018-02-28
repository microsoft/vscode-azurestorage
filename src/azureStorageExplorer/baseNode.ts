/*
  *   Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { IAzureNode } from "vscode-azureextensionui";

// Not required, but provides some base functionality for nodes
export class BaseNode {
  private _temporaryState: string;

  public baseLabel: string;

  public get label(): string {
    return this.baseLabel + (this._temporaryState ? ` (${this._temporaryState})` : "");
  }

  public async refreshLabel(): Promise<void> {
    // Defining this is required for runWithTemporaryState to work
  }

  public async runWithTemporaryState(tempState: string, node: IAzureNode, callback: () => Promise<void>): Promise<void> {
    this._temporaryState = tempState;
    try {
      await node.refresh();
      await callback();
    } finally {
      this._temporaryState = undefined;
      await node.refresh();
    }
  }
}
