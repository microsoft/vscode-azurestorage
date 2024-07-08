# Change Log

## Unreleased

## 0.16.0 - 2024-07-08
### Added
* [[1250]](https://github.com/microsoft/vscode-azurestorage/pull/1250) Add actions submenu to workspace view title
* [[1271]](https://github.com/microsoft/vscode-azurestorage/pull/1271) Add icon to create command

### Fixed
* [[1302]](https://github.com/microsoft/vscode-azurestorage/pull/1302) Fix drag & drop to upload to Azurite
* [[1270]](https://github.com/microsoft/vscode-azurestorage/pull/1270) Fix icons not showing when using light themes

### Engineering
* [[1276]](https://github.com/microsoft/vscode-azurestorage/pull/1276) Remove dependency on the Azure Account extension

## 0.15.3 - 2023-06-12

### Fixed
* Too Many Requests error when opening a blob container using file system provider [#1222](https://github.com/microsoft/vscode-azurestorage/issues/1222)

## 0.15.2 - 2023-05-17

### Added
* Add support for the upcoming Azure Resources Focus feature

## 0.15.1 - 2023-02-08

### Added
- Support for Azure Resources API v2

### Engineering
- Intentionally override base property by @alexweininger in [#1173](https://github.com/microsoft/vscode-azurestorage/pull/1173)
- Remove extra nonNull util by @alexweininger in [#1174](https://github.com/microsoft/vscode-azurestorage/pull/1174)
- Add .nvmrc file by @alexweininger in [#1190](https://github.com/microsoft/vscode-azurestorage/pull/1190)
- Initial conversion to a v1.5 extension by @alexweininger in [#1195](https://github.com/microsoft/vscode-azurestorage/pull/1195)
- Fix AzureStorageFS id parsing by @alexweininger in [#1194](https://github.com/microsoft/vscode-azurestorage/pull/1194)
- Remove expected child context value by @alexweininger in [#1211](https://github.com/microsoft/vscode-azurestorage/pull/1211)

### Dependencies
- Bump @xmldom/xmldom from 0.7.5 to 0.7.8 by @dependabot in [#1181](https://github.com/microsoft/vscode-azurestorage/pull/1181)
- Bump yargs-parser and yargs by @dependabot in [#1182](https://github.com/microsoft/vscode-azurestorage/pull/1182)
- Bump loader-utils from 1.4.0 to 1.4.2 by @dependabot in [#1186](https://github.com/microsoft/vscode-azurestorage/pull/1186)
- Bump decode-uri-component from 0.2.0 to 0.2.2 by @dependabot in [#1187](https://github.com/microsoft/vscode-azurestorage/pull/1187)
- Bump minimatch and mocha by @dependabot in [#1188](https://github.com/microsoft/vscode-azurestorage/pull/1188)
- Bump simple-git from 3.7.0 to 3.15.1 by @dependabot in [#1189](https://github.com/microsoft/vscode-azurestorage/pull/1189)
- Bump json5 from 1.0.1 to 1.0.2 by @dependabot in [#1193](https://github.com/microsoft/vscode-azurestorage/pull/1193)
- Bump simple-git from 3.15.1 to 3.16.0 by @dependabot in [#1197](https://github.com/microsoft/vscode-azurestorage/pull/1197)

## 0.15.0 - 2022-09-15

### Added
- Support for Virtual Workspaces [#1118](https://github.com/microsoft/vscode-azurestorage/pull/1118)
- Support for deleting many blobs and file shares [#1113](https://github.com/microsoft/vscode-azurestorage/pull/1113)
- Support for emulated tables [#1105](https://github.com/microsoft/vscode-azurestorage/pull/1105)
- Uploaded files to blob containers automatically log file URL's to output [#1076](https://github.com/microsoft/vscode-azurestorage/pull/1076)
- Activity log support when deleting a folder in a blob container [#1123](https://github.com/microsoft/vscode-azurestorage/pull/1123)
- Download from SAS URL command to Local Workspace view [#1151](https://github.com/microsoft/vscode-azurestorage/pull/1151)
- Download support for File Shares and Blob Containers [#1121](https://github.com/microsoft/vscode-azurestorage/pull/1121)

### Changed
- "Open in File Explorer" command changed to "Open in Explorer" [#1110](https://github.com/microsoft/vscode-azurestorage/pull/1110)
- Disabled "Open in Storage Explorer" default behavior when in remote workspace [#1109](https://github.com/microsoft/vscode-azurestorage/pull/1109)
- Minimum VS code version that is supported is now version 1.66.2 [#1106](https://github.com/microsoft/vscode-azurestorage/pull/1106)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?q=is%3Aclosed+is%3Aissue+milestone%3A0.15.0)
- Errors associated with Attached Storage Accounts [#1045](https://github.com/microsoft/vscode-azurestorage/issues/1045)

## 0.14.2 - 2022-07-05

### Added
- Automatically log uploaded file URLs to output + quick copy functionality [#1076](https://github.com/microsoft/vscode-azurestorage/pull/1076)

### Changed
- Update @vscode/extension-telemetry to 0.6.2 [#1078](https://github.com/microsoft/vscode-azurestorage/pull/1078)

## 0.14.1 - 2022-06-01

### Changed
- Update @vscode/extension-telemetry to 0.5.2 [#1069](https://github.com/microsoft/vscode-azurestorage/pull/1069)

## 0.14.0 - 2022-05-24

We've made some large design changes to the Azure extensions for VS Code. [View App Centric release notes](https://aka.ms/AzCode/AppCentric)

## 0.13.0 - 2022-01-25

### Added
- Support for creating storage accounts in extended regions using Advanced create.

### Changed
- Minimum version of VS Code is now 1.57.0

## 0.12.1 - 2021-06-10
### Added
- Support for Azure Stack

### Changed
- Icons updated to match VS Code's theme. Install new product icon themes [here](https://marketplace.visualstudio.com/search?term=tag%3Aproduct-icon-theme&target=VSCode)

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.12.1+)

## 0.12.0 - 2021-02-26
### Added
- Now depends on the "Azure Resources" extension, which provides a "Resource Groups" and "Help and Feedback" view

### Changed
- "Report an Issue" button was removed from errors. Use the "Help and Feedback" view or command palette instead

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.12.0+)

## 0.11.0 - 2020-11-02
### Added
- Support for downloading multiple blobs, files, and directories at a time
- Added setting "azureStorage.deleteBeforeDeploy" to delete existing blobs before deploying to static website (defaults to "true")
- View AzCopy log files when transfers fail

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.11.0+)

## 0.10.1 - 2020-10-02
### Added
- Choose the destination directory when uploading resources

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.10.1+)

## 0.10.0 - 2020-09-14
### Added
- File and folder transfers now use AzCopy for faster performance
- Upload multiple files using the `Upload Files...` command
- Upload folders using the `Upload Folder...` command

### Changed
- Removed the 4MB upload/download limit

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.10.0+)


## 0.9.0 - 2020-03-13
### Added
- Azure Storage Emulator support
- Attach storage accounts using connection strings
- `Upload to Azure Storage...` command for uploading local files and folders
- Inline button for the `Open in File Explorer...` command

### Changed
- Improved experiences for deployment and storage account creation
- Show the tree hierarchy when creating nested blobs in the Azure view

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.9.0+)

## 0.8.0 - 2020-01-21
### Added
- View and edit Azure files and blobs in the file explorer
- Blobs have a hierarchical directory structure in the Azure view
- Enable "Secure transfer required" by default when creating storage accounts

### Changed
- `Create Storage Account...` has been streamlined with fewer prompts. `Create Storage Account... (Advanced)`
provides the same level of account customization as before
- Files and blobs created with a file extension have a smart default content type
- Editing files and blobs doesn't clear metadata or properties

### Fixed
- [Bugs fixed](https://github.com/microsoft/vscode-azurestorage/issues?utf8=%E2%9C%93&q=is%3Aclosed+is%3Aissue+milestone%3A0.8.0+)

## 0.7.2 - 2019-10-11
### Fixed
- Deploying folders beginning with `.` to static websites is allowed [#457](https://github.com/Microsoft/vscode-azurestorage/issues/457)
- Copying connection strings works properly for VS Code remote [#459](https://github.com/Microsoft/vscode-azurestorage/issues/459)

## 0.7.1 - 2019-07-31
### Fixed
- Deployment of large static websites lead to timeout errors
[#352](https://github.com/Microsoft/vscode-azurestorage/issues/352), [#345](https://github.com/Microsoft/vscode-azurestorage/issues/345), [#370](https://github.com/Microsoft/vscode-azurestorage/issues/370), [#334](https://github.com/Microsoft/vscode-azurestorage/issues/334), [#340](https://github.com/Microsoft/vscode-azurestorage/issues/340), [#338](https://github.com/Microsoft/vscode-azurestorage/issues/338), [#339](https://github.com/Microsoft/vscode-azurestorage/issues/339), [#342](https://github.com/Microsoft/vscode-azurestorage/issues/342), [#317](https://github.com/Microsoft/vscode-azurestorage/issues/317), [#362](https://github.com/Microsoft/vscode-azurestorage/issues/362)

## 0.7.0 - 2019-02-19
### Fixed
- Improved installation and start-up performance

## 0.6.0 - 2019-02-01
### Fixed
- Web apps containing out, dist, or build folders will have more convenient defaults when deploying to a static website [#176](https://github.com/Microsoft/vscode-azurestorage/issues/176), [#173](https://github.com/Microsoft/vscode-azurestorage/issues/173)
- Validation of text file name during file creation [#148](https://github.com/Microsoft/vscode-azurestorage/issues/148)

### Added
- Enabling, disabling and configuring static website capability from the extension [#153](https://github.com/Microsoft/vscode-azurestorage/issues/153), [#277](https://github.com/Microsoft/vscode-azurestorage/issues/277)
- Creating (GPv2) and deleting storage accounts from the extension [#278](https://github.com/Microsoft/vscode-azurestorage/issues/278), [#291](https://github.com/Microsoft/vscode-azurestorage/issues/291)

## 0.5.0 - 2018-12-11
### Fixed
- [Copy connection string](https://github.com/Microsoft/vscode-azurestorage/issues/141) now works on linux

### Added
- [Themed icons](https://github.com/Microsoft/vscode-azurestorage/issues/6)
- [Pre-publish for static websites](https://github.com/Microsoft/vscode-azurestorage/issues/216)
- Provisional support for [sovereign accounts in Azure](https://github.com/Microsoft/vscode-azurestorage/pull/253)

## 0.4.2 - 2018-09-28

### Fixed
- Can get a command not found error attempting to run some commands before extension is activated [#232](https://github.com/Microsoft/vscode-azurestorage/issues/232)

## 0.4.1 - 2018-07-30

### Changed
- Static website functionality is now enabled always in the extension (azureStorage.preview.staticWebsites setting has been removed)

### Added
- "Browse Static Website…" will bring up a storage account's primary web endpoint in a browser (see [Deploy to Static Website](README.md/#deploy-to-static-website))

### Fixed
- Can now browse directly after deploying (no need to go to Portal to get primary web endpoint)
- Ensure storage account can support hosted websites and that it is enabled when deploying, browsing etc., fixes [#174](https://github.com/Microsoft/vscode-azurestorage/issues/174), [#175](https://github.com/Microsoft/vscode-azurestorage/issues/175)
- Ensure website hosting has an index document set when browsing (to avoid getting a 404 error)

## 0.4.0 - 2018-06-18

### Added
- Deploy to static websites (preview feature, must be [enabled](README.md/#preview-features) first)

## 0.3.1 - 2018-05-09

### Added
- Newly-created blobs and files are now opened immediately in the editor
- Copy URL to clipboard (blob, blob container, file, directory, or file share)

### Changed
- Moved Azure Storage Explorer to new Azure view container instead of file explorer

## 0.3.0 - 2018-04-05
### Added
- Upload and download block blobs with text contents, up to 4MB
- Refresh menu added to additional nodes in the tree
- New filter button on subscription nodes to make selecting Azure subscriptions easier

### Fixed
- Saving a blob from the editor will no longer cause loss of content type and other properties
- Will no longer overwrite an existing blob when creating a new one with the same name
- Removed redundant Close button in some dialogs

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
