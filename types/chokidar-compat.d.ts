// Compatibility shim for chokidar 4.x with @types/gulp
declare module 'chokidar' {
    export interface WatchOptions {
        persistent?: boolean;
        ignoreInitial?: boolean;
        followSymlinks?: boolean;
        cwd?: string;
        usePolling?: boolean;
        interval?: number;
        binaryInterval?: number;
        alwaysStat?: boolean;
        depth?: number;
        ignorePermissionErrors?: boolean;
        atomic?: boolean | number;
        ignored?: string | RegExp | ((path: string) => boolean);
        awaitWriteFinish?: boolean | { stabilityThreshold?: number; pollInterval?: number; };
    }
}