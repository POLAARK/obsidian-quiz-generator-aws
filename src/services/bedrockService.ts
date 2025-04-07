import { BedrockClient, ListFoundationModelsCommand} from "@aws-sdk/client-bedrock";

export interface BedrockModel {
    modelId: string;
    displayName?: string;
}

interface FoundationModelSummary {
    modelId: string;
    modelName?: string;
}

export async function getAvailableModels(region: string, accessKeyId: string, secretAccessKey: string): Promise<BedrockModel[]> {
    const client = new BedrockClient({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    try {
        const command = new ListFoundationModelsCommand({byOutputModality: "TEXT", byInferenceType: "ON_DEMAND"});
        const response = await client.send(command);
        
        // Filter for text generation models and format them
        return ((response.modelSummaries || []) as FoundationModelSummary[])
            .filter((model: FoundationModelSummary) => 
                model.modelId && 
                (model.modelId.includes('text') || 
                 model.modelId.includes('claude') || 
                 model.modelId.includes('llama'))
            )
            .map((model: FoundationModelSummary) => ({
                modelId: model.modelId,
                displayName: model.modelName || model.modelId
            }));
    } catch (error) {
        console.error('Error fetching Bedrock models:', error);
        throw error;
    }
}
