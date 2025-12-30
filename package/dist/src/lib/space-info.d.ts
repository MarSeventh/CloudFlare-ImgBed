import type { ApiSpaceInfo } from "../types/api/api-space";
import type { CredentialsParams } from "../types/public";
import type { SPACE_EXPANDABLE_KEYS, SpaceEntry } from "./list-spaces";
import { SPACE_EXPAND_KEYS } from "./list-spaces";
export declare function spaceInfo<const T extends Exclude<(typeof SPACE_EXPANDABLE_KEYS)[number], (typeof SPACE_EXPAND_KEYS)[number]> = never>(params: {
    name: string;
    hubUrl?: string;
    additionalFields?: T[];
    /**
     * An optional Git revision id which can be a branch name, a tag, or a commit hash.
     */
    revision?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<SpaceEntry & Pick<ApiSpaceInfo, T>>;
//# sourceMappingURL=space-info.d.ts.map