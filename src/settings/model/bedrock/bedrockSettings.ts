import { Notice, Setting } from "obsidian";
import QuizGenerator from "../../../main";
import { BedrockTextGenModel } from "../../../generators/bedrock/bedrockModels";
import { DEFAULT_BEDROCK_SETTINGS } from "./bedrockConfig";
import { BedrockModel, getAvailableModels } from "../../../services/bedrockService";

const displayBedrockSettings = async (containerEl: HTMLElement, plugin: QuizGenerator, refreshSettings: () => void): Promise<void> => {
    let availableModels: BedrockModel[] = [];

    // Try to fetch available models if credentials are set
    if (plugin.settings.bedrockAccessKeyId && 
        plugin.settings.bedrockSecretAccessKey && 
        plugin.settings.bedrockRegion) {
        try {
            availableModels = await getAvailableModels(
                plugin.settings.bedrockRegion,
                plugin.settings.bedrockAccessKeyId,
                plugin.settings.bedrockSecretAccessKey
            );
        } catch (error) {
            console.error('Failed to fetch Bedrock models:', error);
            new Notice('Failed to fetch available Bedrock models. Please check your credentials and region.');
        }
    }
    new Setting(containerEl)
        .setName("AWS Access Key ID")
        .setDesc("Your AWS Access Key ID for Bedrock access")
        .addText(text =>
            text
                .setPlaceholder("Enter your AWS Access Key ID")
                .setValue(plugin.settings.bedrockAccessKeyId)
                .onChange(async (value) => {
                    plugin.settings.bedrockAccessKeyId = value.trim();
                    await plugin.saveSettings();
                }).inputEl.type = "password"
        );

    new Setting(containerEl)
        .setName("AWS Secret Access Key")
        .setDesc("Your AWS Secret Access Key for Bedrock access")
        .addText(text =>
            text
                .setPlaceholder("Enter your AWS Secret Access Key")
                .setValue(plugin.settings.bedrockSecretAccessKey)
                .onChange(async (value) => {
                    plugin.settings.bedrockSecretAccessKey = value.trim();
                    await plugin.saveSettings();
                }).inputEl.type = "password"
        );

    new Setting(containerEl)
        .setName("AWS Region")
        .setDesc("The AWS region where Bedrock is available")
        .addButton(button =>
            button
                .setClass("clickable-icon")
                .setIcon("rotate-ccw")
                .setTooltip("Restore default")
                .onClick(async () => {
                    plugin.settings.bedrockRegion = DEFAULT_BEDROCK_SETTINGS.bedrockRegion;
                    await plugin.saveSettings();
                    refreshSettings();
                })
        )
        .addText(text =>
            text
                .setPlaceholder("e.g., us-west-2")
                .setValue(plugin.settings.bedrockRegion)
                .onChange(async (value) => {
                    plugin.settings.bedrockRegion = value.trim();
                    await plugin.saveSettings();
                })
        );

    new Setting(containerEl)
        .setName("Model")
        .setDesc("Choose the Bedrock model to use")
        .addDropdown(dropdown => {
            // If we have fetched models, use them
            if (availableModels.length > 0) {
                availableModels.forEach((model) => {
                    dropdown.addOption(model.modelId, model.modelId);
                });
            } else {
                // Fallback to enum values if no models fetched
                Object.values(BedrockTextGenModel).forEach((model) => {
                    dropdown.addOption(model, model);
                });
            }
            return dropdown
                .setValue(plugin.settings.bedrockModel)
                .onChange(async (value) => {
                    plugin.settings.bedrockModel = value;
                    await plugin.saveSettings();
                });
        });
};

export default displayBedrockSettings;
