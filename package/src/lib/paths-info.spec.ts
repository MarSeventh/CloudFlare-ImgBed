import { expect, it, describe } from "vitest";
import type { CommitInfo, PathInfo, SecurityFileStatus } from "./paths-info";
import { pathsInfo } from "./paths-info";

describe("pathsInfo", () => {
	it("should fetch LFS path info", async () => {
		const result: PathInfo[] = await pathsInfo({
			repo: {
				name: "google-bert/bert-base-uncased",
				type: "model",
			},
			paths: ["tf_model.h5"],
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
		});

		expect(result).toHaveLength(1);

		const modelPathInfo = result[0];
		expect(modelPathInfo.path).toBe("tf_model.h5");
		expect(modelPathInfo.type).toBe("file");
		// lfs pointer, therefore lfs should be defined
		expect(modelPathInfo?.lfs).toBeDefined();
		expect(modelPathInfo?.lfs?.oid).toBe("a7a17d6d844b5de815ccab5f42cad6d24496db3850a2a43d8258221018ce87d2");
		expect(modelPathInfo?.lfs?.size).toBe(536063208);
		expect(modelPathInfo?.lfs?.pointerSize).toBe(134);

		// should not include expand info
		expect(modelPathInfo.lastCommit).toBeUndefined();
		expect(modelPathInfo.securityFileStatus).toBeUndefined();
	});

	it("expand parmas should fetch lastCommit and securityFileStatus", async () => {
		const result: (PathInfo & {
			lastCommit: CommitInfo;
			securityFileStatus: SecurityFileStatus;
		})[] = await pathsInfo({
			repo: {
				name: "google-bert/bert-base-uncased",
				type: "model",
			},
			paths: ["tf_model.h5"],
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
			expand: true, // include
		});

		expect(result).toHaveLength(1);

		const modelPathInfo = result[0];

		// should include expand info
		expect(modelPathInfo.lastCommit).toBeDefined();
		expect(modelPathInfo.securityFileStatus).toBeDefined();

		expect(modelPathInfo.lastCommit.id).toBe("dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7");
		expect(modelPathInfo.lastCommit.title).toBe("Update tf_model.h5");
		expect(modelPathInfo.lastCommit.date.getTime()).toBe(1569268124000); // 2019-09-23T19:48:44.000Z
	});

	it("non-LFS pointer should have lfs undefined", async () => {
		const result: PathInfo[] = await pathsInfo({
			repo: {
				name: "google-bert/bert-base-uncased",
				type: "model",
			},
			paths: ["config.json"],
			revision: "dd4bc8b21efa05ec961e3efc4ee5e3832a3679c7",
		});

		expect(result).toHaveLength(1);

		const modelPathInfo = result[0];
		expect(modelPathInfo.path).toBe("config.json");
		expect(modelPathInfo.lfs).toBeUndefined();
	});
});
