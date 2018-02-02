# Change Log
All notable changes to the "vscode-azurestorage" extension will be documented in this file.

## 0.2.0 - 2018-02-02
### Added
- Create and delete blob containers, file shares, queues and tables
- Create empty block blobs (text only), files and directories
- Delete blobs, files and directories

### Fixed
- Improved error handling

## 0.1.3 - 2017-12-15
### Added
 - Changed TreeItems to use the common ui library 'vscode-azureextensionui'.

### Fixed
 - Fixed hash-mismatch issue for Blob and File Download by using 'ToLocalFile' instead of 'ToText' download methods.

## 0.1.2 - 2017-12-13
### Fixed
 - Resolved extension loading issue on Windows machines.

## 0.1.1 - 2017-12-08
### Fixed
 - Updated package to have better description.

## 0.1.0 - 2017-12-08
### Added
 - Explore Blob Containers, File Shares, Queues and Tables
 - Access Connection String and Primary Key
 - Edit Block Blobs and Files
 - Open in Storage Explorer for memory or computationally heavy tasks.
