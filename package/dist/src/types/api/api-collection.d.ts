import type { ApiAuthor } from "./api-author";
export interface ApiCollectionInfo {
    slug: string;
    title: string;
    description?: string;
    lastUpdated: string;
    gating: true | (false | {
        mode: "auto";
    } | {
        mode: "manual";
        notifications: {
            mode: "bulk" | "real-time";
            email?: string;
        };
    });
    owner: ApiAuthor;
    /**
     * Note that it's limited to 4 items when the listing endpoint is used.
     */
    items: ApiCollectionItem[];
    theme: "orange" | "blue" | "green" | "purple" | "pink" | "indigo";
    private: boolean;
    upvotes: number;
    isUpvotedByUser: boolean;
}
interface ApiCollectionItemBase {
    _id: string;
    position: number;
    note?: {
        html: string;
        text: string;
    };
    gallery?: string[];
}
interface ApiCollectionItemModel extends ApiCollectionItemBase {
    type: "model";
    author: string;
    downloads: number;
    id: string;
    availableInferenceProviders: {
        provider: "black-forest-labs" | "cerebras" | "cohere" | "fal-ai" | "featherless-ai" | "fireworks-ai" | "groq" | "hf-inference" | "hyperbolic" | "nebius" | "novita" | "nscale" | "openai" | "ovhcloud" | "replicate" | "sambanova" | "together";
        providerStatus: "live" | "staging" | "error";
        modelStatus: "live" | "staging" | "error";
        providerId: string;
        task: "text-classification" | "token-classification" | "table-question-answering" | "question-answering" | "zero-shot-classification" | "translation" | "summarization" | "feature-extraction" | "text-generation" | "text2text-generation" | "fill-mask" | "sentence-similarity" | "text-to-speech" | "text-to-audio" | "automatic-speech-recognition" | "audio-to-audio" | "audio-classification" | "audio-text-to-text" | "voice-activity-detection" | "depth-estimation" | "image-classification" | "object-detection" | "image-segmentation" | "text-to-image" | "image-to-text" | "image-to-image" | "image-to-video" | "unconditional-image-generation" | "video-classification" | "reinforcement-learning" | "robotics" | "tabular-classification" | "tabular-regression" | "tabular-to-text" | "table-to-text" | "multiple-choice" | "text-ranking" | "text-retrieval" | "time-series-forecasting" | "text-to-video" | "image-text-to-text" | "visual-question-answering" | "document-question-answering" | "zero-shot-image-classification" | "graph-ml" | "mask-generation" | "zero-shot-object-detection" | "text-to-3d" | "image-to-3d" | "image-feature-extraction" | "video-text-to-text" | "keypoint-detection" | "visual-document-retrieval" | "any-to-any" | "video-to-video" | "other" | "conversational";
        adapterType?: "lora";
        adapterWeightsPath?: string;
    }[];
    isLikedByUser: boolean;
    lastModified: string;
    likes: number;
    pipeline_tag?: string;
    private: boolean;
    repoType: "model";
    gated: false | ("auto" | "manual");
    resourceGroup?: {
        id: string;
        name: string;
        numUsers: number;
    };
    numParameters?: number;
    authorData?: ApiAuthor;
    widgetOutputUrls?: string[];
}
interface ApiCollectionItemDataset extends ApiCollectionItemBase {
    type: "dataset";
    author: string;
    id: string;
    isLikedByUser: boolean;
    likes: number;
    datasetsServerInfo?: {
        viewer: "preview" | "viewer-partial" | "viewer";
        numRows: number | null;
        libraries: ("mlcroissant" | "webdataset" | "datasets" | "pandas" | "dask" | "distilabel" | "fiftyone" | "argilla" | "polars" | "duckdb")[];
        formats: ("json" | "csv" | "parquet" | "imagefolder" | "audiofolder" | "webdataset" | "text" | "arrow")[];
        modalities: ("3d" | "audio" | "document" | "geospatial" | "image" | "tabular" | "text" | "timeseries" | "video")[];
    };
    private: boolean;
    repoType: "dataset";
    downloads: number;
    gated: false | ("auto" | "manual");
    lastModified: string;
    resourceGroup?: {
        id: string;
        name: string;
        numUsers: number;
    };
}
interface ApiCollectionItemSpace extends ApiCollectionItemBase {
    type: "space";
    author: string;
    colorFrom: string;
    colorTo: string;
    createdAt: string;
    emoji: string;
    id: string;
    isLikedByUser: boolean;
    lastModified: string;
    likes: number;
    pinned: boolean;
    private: boolean;
    featured: boolean;
    repoType: "space";
    title: string;
    sdk?: "gradio" | "docker" | "static" | "streamlit";
    runtime: {
        stage: "NO_APP_FILE" | "CONFIG_ERROR" | "BUILDING" | "BUILD_ERROR" | "APP_STARTING" | "RUNNING" | "RUNNING_BUILDING" | "RUNNING_APP_STARTING" | "RUNTIME_ERROR" | "DELETING" | "STOPPED" | "PAUSED" | "SLEEPING";
        hardware: {
            current: ("cpu-basic" | "cpu-upgrade" | "cpu-performance" | "cpu-xl" | "zero-a10g" | "t4-small" | "t4-medium" | "l4x1" | "l4x4" | "l40sx1" | "l40sx4" | "l40sx8" | "a10g-small" | "a10g-large" | "a10g-largex2" | "a10g-largex4" | "a100-large" | "h100" | "h100x8") | null;
            requested: ("cpu-basic" | "cpu-upgrade" | "cpu-performance" | "cpu-xl" | "zero-a10g" | "t4-small" | "t4-medium" | "l4x1" | "l4x4" | "l40sx1" | "l40sx4" | "l40sx8" | "a10g-small" | "a10g-large" | "a10g-largex2" | "a10g-largex4" | "a100-large" | "h100" | "h100x8") | null;
        };
        storage: ("small" | "medium" | "large") | null;
        errorMessage?: string;
        gcTimeout?: number | null;
        replicas: {
            current?: number | null;
            requested: number | "auto";
        };
        devMode?: boolean;
        domains?: {
            domain: string;
            isCustom?: boolean | null;
            stage: "READY" | "PENDING";
        }[];
        sha?: string;
    };
    originSpace?: {
        author: ApiAuthor;
        name: string;
    };
    ai_short_description?: string;
    ai_category?: string;
    trendingScore?: number;
    resourceGroup?: {
        id: string;
        name: string;
        numUsers: number;
    };
    tags: string[];
    authorData?: ApiAuthor;
    shortDescription?: string;
    semanticRelevancyScore?: number;
}
interface ApiCollectionItemPaper extends ApiCollectionItemBase {
    type: "paper";
    id: string;
    title: string;
    upvotes: number;
    publishedAt: string;
    thumbnailUrl?: string;
    isUpvotedByUser?: boolean;
}
interface ApiCollectionItemCollection extends ApiCollectionItemBase {
    type: "collection";
    slug: string;
    lastUpdated: string;
    description?: string;
    owner: ApiAuthor;
    title: string;
    theme: "orange" | "blue" | "green" | "purple" | "pink" | "indigo";
    upvotes: number;
    isUpvotedByUser: boolean;
    id: string;
    numberItems: number;
    shareUrl: string;
}
type ApiCollectionItem = ApiCollectionItemModel | ApiCollectionItemDataset | ApiCollectionItemSpace | ApiCollectionItemPaper | ApiCollectionItemCollection;
export {};
//# sourceMappingURL=api-collection.d.ts.map