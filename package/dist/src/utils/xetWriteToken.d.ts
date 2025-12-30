import type { XetTokenParams } from "./uploadShards";
export interface XetWriteTokenParams {
    accessToken: string | undefined;
    fetch?: typeof fetch;
    xetParams: XetTokenParams;
}
export declare function xetWriteToken(params: XetWriteTokenParams): Promise<{
    accessToken: string;
    casUrl: string;
}>;
//# sourceMappingURL=xetWriteToken.d.ts.map