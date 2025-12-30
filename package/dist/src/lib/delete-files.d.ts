import type { CredentialsParams } from "../types/public";
import type { CommitOutput, CommitParams } from "./commit";
export declare function deleteFiles(params: {
    repo: CommitParams["repo"];
    paths: string[];
    commitTitle?: CommitParams["title"];
    commitDescription?: CommitParams["description"];
    hubUrl?: CommitParams["hubUrl"];
    branch?: CommitParams["branch"];
    isPullRequest?: CommitParams["isPullRequest"];
    parentCommit?: CommitParams["parentCommit"];
    fetch?: CommitParams["fetch"];
} & CredentialsParams): Promise<CommitOutput>;
//# sourceMappingURL=delete-files.d.ts.map