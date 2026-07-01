/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getProxySettings, type ProxySettings } from '@microsoft/vscode-azext-azureutils';

/**
 * Merges VS Code's proxy configuration (`http.proxy` / `http.noProxy`, with the standard proxy
 * environment variables as a fallback) into the pipeline options used to construct a storage
 * data-plane service client, so requests route through a corporate proxy.
 *
 * The storage SDKs (`@azure/storage-blob`, `-file-share`, `-queue`) do not consult VS Code's
 * `http.*` settings on their own, so operations fail on networks that require an explicit proxy.
 * Returns `options` unchanged when no proxy applies to `endpointUrl` (for example when the host is
 * matched by `http.noProxy`/`NO_PROXY`, or proxy support is turned off).
 */
export function withProxyOptions(endpointUrl: string): { proxyOptions?: ProxySettings } | undefined;
export function withProxyOptions<T extends object>(endpointUrl: string, options: T): (T & { proxyOptions?: ProxySettings }) | undefined;
export function withProxyOptions<T extends object>(endpointUrl: string, options?: T): (T & { proxyOptions?: ProxySettings }) | { proxyOptions?: ProxySettings } | undefined {
    const proxyOptions = getProxySettings(endpointUrl);
    if (!proxyOptions) {
        return options;
    }
    return options ? { ...options, proxyOptions } : { proxyOptions };
}
