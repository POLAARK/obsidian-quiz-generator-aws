import { Notice } from "obsidian";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import Generator from "../generator";
import { QuizSettings } from "../../settings/config";
import { BedrockTextGenModel } from "./bedrockModels";

interface ContentItem {
    type: "text";
    text: string;
}

interface ResponseMessage {
    id: string;
    type: string;
    role: string;
    content: ContentItem[];
    stop_reason: string;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface ModelRequestBody {
    anthropic_version: string;
    max_tokens: number;
    messages: {
        role: "user";
        content: ContentItem[];
    }[];
    temperature: number;
    top_p: number;
}

export default class BedrockGenerator extends Generator {
    private readonly client: BedrockRuntimeClient;

    constructor(settings: QuizSettings) {
        super(settings);
        this.client = new BedrockRuntimeClient({
            credentials: {
                accessKeyId: settings.bedrockAccessKeyId,
                secretAccessKey: settings.bedrockSecretAccessKey
            },
            region: settings.bedrockRegion
        });
    }

    public async generateQuiz(contents: string[]): Promise<string | null> {
        try {
            const prompt = this.createPrompt(contents);
            const response = await this.invokeModel(prompt);
            return response;
        } catch (error) {
            throw new Error((error as Error).message);
        }
    }

    private async invokeModel(prompt: string): Promise<string> {
        const modelId = this.settings.bedrockModel;
        const body = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 4096,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        }
                    ]
                }
            ],
            temperature: 0.7,
            top_p: 0.9
        };

        const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(body)
        });

        try {
            const response = await this.client.send(command);
            const responseBody = new TextDecoder().decode(response.body);
            const parsedResponse = JSON.parse(responseBody);

            return parsedResponse.content[0].text;
        } catch (error) {
            new Notice(`Error generating quiz: ${(error as Error).message}`);
            throw error;
        }
    }

    public async shortOrLongAnswerSimilarity(userAnswer: string, answer: string): Promise<number> {
        // For now, use a simple string comparison since Bedrock doesn't have a dedicated embeddings API
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();
        const normalizedAnswer = answer.toLowerCase().trim();
        return normalizedUserAnswer === normalizedAnswer ? 1 : 0;
    }

    private createPrompt(contents: string[]): string {
        return `${this.systemPrompt()}\n\n${this.userPrompt(contents)}`;
    }
}
