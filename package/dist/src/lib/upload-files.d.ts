import type { CredentialsParams } from "../types/public";
import type { CommitOutput, CommitParams, ContentSource } from "./commit";
export declare function uploadFiles(params: {
    repo: CommitParams["repo"];
    files: Array<URL | File | {
        path: string;
        content: ContentSource;
    }>;
    commitTitle?: CommitParams["title"];
    commitDescription?: CommitParams["description"];
    hubUrl?: CommitParams["hubUrl"];
    branch?: CommitParams["branch"];
    isPullRequest?: CommitParams["isPullRequest"];
    parentCommit?: CommitParams["parentCommit"];
    fetch?: CommitParams["fetch"];
    useWebWorkers?: CommitParams["useWebWorkers"];
    maxFolderDepth?: CommitParams["maxFolderDepth"];
    abortSignal?: CommitParams["abortSignal"];
    useXet?: CommitParams["useXet"];
} & Partial<CredentialsParams>): Promise<CommitOutput>;
//# sourceMappingURL=upload-files.d.ts.map