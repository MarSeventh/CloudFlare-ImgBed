import type { CredentialsParams } from "../types/public";
import type { CommitOutput, CommitParams } from "./commit";
import { commit } from "./commit";

export function deleteFile(
	params: {
		repo: CommitParams["repo"];
		path: string;
		commitTitle?: CommitParams["title"];
		commitDescription?: CommitParams["description"];
		hubUrl?: CommitParams["hubUrl"];
		fetch?: CommitParams["fetch"];
		branch?: CommitParams["branch"];
		isPullRequest?: CommitParams["isPullRequest"];
		parentCommit?: CommitParams["parentCommit"];
	} & CredentialsParams
): Promise<CommitOutput> {
	return commit({
		...(params.accessToken ? { accessToken: params.accessToken } : { credentials: params.credentials }),
		repo: params.repo,
		operations: [
			{
				operation: "delete",
				path: params.path,
			},
		],
		title: params.commitTitle ?? `Delete ${params.path}`,
		description: params.commitDescription,
		hubUrl: params.hubUrl,
		branch: params.branch,
		isPullRequest: params.isPullRequest,
		parentCommit: params.parentCommit,
		fetch: params.fetch,
	});
}
