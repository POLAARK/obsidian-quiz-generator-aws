import { BedrockTextGenModel } from "../../../generators/bedrock/bedrockModels";

export interface BedrockConfig {
    bedrockAccessKeyId: string;
    bedrockSecretAccessKey: string;
    bedrockRegion: string;
    bedrockModel: string;
}

export const DEFAULT_BEDROCK_SETTINGS: BedrockConfig = {
    bedrockAccessKeyId: "",
    bedrockSecretAccessKey: "",
    bedrockRegion: "us-east-1",
    bedrockModel: BedrockTextGenModel.CLAUDE,
};
