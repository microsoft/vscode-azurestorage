/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JSDOM } from "jsdom";

const { window } = new JSDOM();

export function polyfill(): void {
    if (!globalThis.document) {
        globalThis.document = window.document;
    }

    if (!globalThis.DOMParser) {
        globalThis.DOMParser = window.DOMParser;
    }

    if (!globalThis.XMLSerializer) {
        globalThis.XMLSerializer = window.XMLSerializer;
    }

    if (!globalThis.Node) {
        globalThis.Node = window.Node;
    }
}
