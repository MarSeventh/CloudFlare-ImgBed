import type { ApiSpaceInfo } from "../types/api/api-space";
import type { CredentialsParams, SpaceSdk } from "../types/public";
export declare const SPACE_EXPAND_KEYS: readonly ["sdk", "likes", "private", "lastModified"];
export declare const SPACE_EXPANDABLE_KEYS: readonly ["author", "cardData", "datasets", "disabled", "gitalyUid", "lastModified", "createdAt", "likes", "private", "runtime", "sdk", "sha", "subdomain", "tags", "models"];
export interface SpaceEntry {
    id: string;
    name: string;
    sdk?: SpaceSdk;
    likes: number;
    private: boolean;
    updatedAt: Date;
}
export declare function listSpaces<const T extends Exclude<(typeof SPACE_EXPANDABLE_KEYS)[number], (typeof SPACE_EXPAND_KEYS)[number]> = never>(params?: {
    search?: {
        /**
         * Will search in the space name for matches
         */
        query?: string;
        owner?: string;
        tags?: string[];
    };
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    /**
     * Additional fields to fetch from huggingface.co.
     */
    additionalFields?: T[];
} & Partial<CredentialsParams>): AsyncGenerator<SpaceEntry & Pick<ApiSpaceInfo, T>>;
//# sourceMappingURL=list-spaces.d.ts.map