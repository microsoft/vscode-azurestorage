#!/bin/bash
# Install the AzCopy executables in the same folder as this script and give them executable permissions (Mac/Linux)
npm install --force --prefix . @azure-tools/azcopy-darwin \
    @azure-tools/azcopy-linux \
    @azure-tools/azcopy-win32 \
    @azure-tools/azcopy-win64
chmod u+x node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64 \
    node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64
