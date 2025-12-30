import type { CredentialsParams } from "../types/public";
import type { CommitOutput, CommitParams, ContentSource } from "./commit";
export declare function uploadFile(params: {
    repo: CommitParams["repo"];
    file: URL | File | {
        path: string;
        content: ContentSource;
    };
    commitTitle?: CommitParams["title"];
    commitDescription?: CommitParams["description"];
    hubUrl?: CommitParams["hubUrl"];
    branch?: CommitParams["branch"];
    isPullRequest?: CommitParams["isPullRequest"];
    parentCommit?: CommitParams["parentCommit"];
    fetch?: CommitParams["fetch"];
    useWebWorkers?: CommitParams["useWebWorkers"];
    abortSignal?: CommitParams["abortSignal"];
    useXet?: CommitParams["useXet"];
} & Partial<CredentialsParams>): Promise<CommitOutput>;
//# sourceMappingURL=upload-file.d.ts.map