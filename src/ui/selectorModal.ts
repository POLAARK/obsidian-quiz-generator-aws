import { App, Modal, Notice, setIcon, setTooltip, TFile, TFolder, Vault } from "obsidian";
import GptGenerator from "../generators/gptGenerator";
import QuizGenerator from "../main";
import { cleanUpString } from "../utils/parser";
import { ParsedMC, ParsedQuestions, ParsedSA, ParsedTF } from "../utils/types";
import NoteAndFolderSelector from "./noteAndFolderSelector";
import "styles.css";
import QuizModal from "./quizModal";

export default class SelectorModal extends Modal {
	private readonly plugin: QuizGenerator;
	private notePaths: string[];
	private folderPaths: string[];
	private selectedNotes: Map<string, string>;
	private notesContainer: HTMLDivElement;
	private buttonContainer: HTMLDivElement;
	private tokenSection: HTMLSpanElement;
	private promptTokens: number = 0;
	private questionsAndAnswers: (ParsedMC | ParsedTF | ParsedSA)[];
	private clearButton: HTMLButtonElement;
	private quizButton: HTMLButtonElement;
	private addNoteButton: HTMLButtonElement;
	private addFolderButton: HTMLButtonElement;
	private generateButton: HTMLButtonElement;
	private clearHandler: () => void;
	private openQuizHandler: () => void;
	private addNoteHandler: () => void;
	private addFolderHandler: () => void;
	private generateQuizHandler: () => void;
	private gpt: GptGenerator;
	private quiz: QuizModal;

	constructor(app: App, plugin: QuizGenerator) {
		super(app);
		this.plugin = plugin;
	}

	public onOpen(): void {
		this.notePaths = this.app.vault.getMarkdownFiles().map(file => file.path);
		this.folderPaths = this.app.vault.getAllLoadedFiles()
			.filter(abstractFile => abstractFile instanceof TFolder)
			.map(folder => folder.path);
		this.selectedNotes = new Map<string, string>();
		this.questionsAndAnswers = [];

		this.modalEl.addClass("modal-el-container");
		this.contentEl.addClass("modal-content-container");
		this.titleEl.setText("Selected Notes");
		this.titleEl.addClass("title-style");

		this.displayNoteContainer();
		this.displayTokens();
		this.activateButtons();
		this.displayButtons();

		this.clearButton.disabled = true;
		this.quizButton.disabled = true;
		this.generateButton.disabled = true;
	}

	public onClose(): void {
		super.onClose();
	}

	private displayNoteContainer(): void {
		this.notesContainer = this.contentEl.createDiv("notes-container");
	}

	private activateButtons(): void {
		this.clearHandler = (): void => {
			this.generateButton.disabled = true;
			this.clearButton.disabled = true;
			this.selectedNotes.clear();
			this.notesContainer.empty();
			this.promptTokens = 0;
			this.tokenSection.textContent = "Prompt tokens: " + this.promptTokens;
			this.notePaths = this.app.vault.getMarkdownFiles().map(file => file.path);
			this.folderPaths = this.app.vault.getAllLoadedFiles()
				.filter(abstractFile => abstractFile instanceof TFolder)
				.map(folder => folder.path);
		};

		this.openQuizHandler = (): void => this.quiz.open();

		this.addNoteHandler = (): void => this.showNoteAdder();

		this.addFolderHandler = (): void => this.showFolderAdder();

		this.generateQuizHandler = async (): Promise<void> => {
			if ((this.plugin.settings.generateMultipleChoice || this.plugin.settings.generateTrueFalse
				|| this.plugin.settings.generateShortAnswer) && this.promptTokens > 0) {
				this.generateButton.disabled = true;
				this.questionsAndAnswers.length = 0;
				this.gpt = new GptGenerator(this.plugin);

				new Notice("Generating...");
				let questions = await this.gpt.generateQuestions(this.loadNoteContents());
				questions = questions?.replace(/\\/g, "\\\\");

				if (questions) {
					try {
						const parsedQuestions: ParsedQuestions = JSON.parse(questions);

						for (const key in parsedQuestions) {
							if (parsedQuestions.hasOwnProperty(key)) {
								const value = parsedQuestions[key];

								if (Array.isArray(value)) {
									value.forEach(element => {
										if ("questionMC" in element) {
											this.questionsAndAnswers.push(element as ParsedMC);
										} else if ("questionTF" in element) {
											this.questionsAndAnswers.push(element as ParsedTF);
										} else if ("questionSA" in element) {
											this.questionsAndAnswers.push(element as ParsedSA);
										} else {
											new Notice("A question was generated incorrectly");
										}
									});
								} else {
									new Notice("Failure: Generation returned incorrect format");
								}
							}
						}

						this.quiz = new QuizModal(this.app, this.plugin, this.questionsAndAnswers);
						this.quiz.open();
					} catch (error) {
						new Notice(error);
					}
				} else {
					new Notice("Failure: Generation returned null");
				}

				this.generateButton.disabled = false;
				this.quizButton.disabled = false;
			} else {
				new Notice("Generation cancelled because all question types are set to false or prompt contains 0 tokens");
			}
		}
	}

	private displayButtons(): void {
		this.buttonContainer = this.contentEl.createDiv("selector-button-container");

		this.clearButton = this.buttonContainer.createEl("button");
		this.clearButton.addClass("ui-button");
		setIcon(this.clearButton, "book-x");
		setTooltip(this.clearButton, "Remove all");

		this.quizButton = this.buttonContainer.createEl("button");
		this.quizButton.addClass("ui-button");
		setIcon(this.quizButton, "scroll-text");
		setTooltip(this.quizButton, "Open quiz");

		this.addNoteButton = this.buttonContainer.createEl("button");
		this.addNoteButton.addClass("ui-button");
		setIcon(this.addNoteButton, "file-plus-2");
		setTooltip(this.addNoteButton, "Add note");

		this.addFolderButton = this.buttonContainer.createEl("button");
		this.addFolderButton.addClass("ui-button");
		setIcon(this.addFolderButton, "folder-plus");
		setTooltip(this.addFolderButton, "Add folder");

		this.generateButton = this.buttonContainer.createEl("button");
		this.generateButton.addClass("ui-button");
		setIcon(this.generateButton, "webhook");
		setTooltip(this.generateButton, "Generate");

		this.clearButton.addEventListener("click", this.clearHandler);
		this.quizButton.addEventListener("click", this.openQuizHandler);
		this.addNoteButton.addEventListener("click", this.addNoteHandler);
		this.addFolderButton.addEventListener("click", this.addFolderHandler);
		this.generateButton.addEventListener("click", this.generateQuizHandler);
	}

	private displayTokens(): void {
		this.tokenSection = this.contentEl.createSpan("token-container");
		this.tokenSection.textContent = "Prompt tokens: " + this.promptTokens;
	}

	private showNoteAdder(): void {
		const modal = new NoteAndFolderSelector(this.app, this.notePaths, this.modalEl);

		modal.setCallback(async (selectedItem: string) => {
			const selectedNote = this.app.vault.getFileByPath(selectedItem);

			if (selectedNote instanceof TFile) {
				this.notePaths.remove(selectedNote.path);
				this.showNoteAdder();
				const noteContents = cleanUpString(await this.app.vault.cachedRead(selectedNote));
				this.selectedNotes.set(selectedNote.path, noteContents);
				this.displayNote(selectedNote);
			}
		});

		modal.open();
	}

	private showFolderAdder(): void {
		const modal = new NoteAndFolderSelector(this.app, this.folderPaths, this.modalEl);

		modal.setCallback(async (selectedItem: string) => {
			const selectedFolder = this.app.vault.getFolderByPath(selectedItem);

			if (selectedFolder instanceof TFolder) {
				this.folderPaths.remove(selectedFolder.path);
				this.showFolderAdder();

				let folderContents: string[] = [];
				const promises: any[] = [];

				Vault.recurseChildren(selectedFolder, (file) => {
					if (file instanceof TFile && file.extension === "md") {
						promises.push(
							(async () => {
								folderContents.push(cleanUpString(await this.app.vault.cachedRead(file)));
							})()
						);
					}
				});

				await Promise.all(promises);

				this.selectedNotes.set(selectedFolder.path, folderContents.join(" "));
				this.displayFolder(selectedFolder);
			}
		});

		modal.open();
	}

	private displayNote(note: TFile): void {
		this.clearButton.disabled = false;
		this.generateButton.disabled = false;

		const selectedNoteBox = this.notesContainer.createDiv("notes-container-element");
		this.plugin.settings.showNotePath ?
			selectedNoteBox.textContent = note.path : selectedNoteBox.textContent = note.basename;

		const noteTokensElement = selectedNoteBox.createDiv("note-tokens");
		const noteTokens = this.countNoteTokens(this.selectedNotes.get(note.path));
		noteTokensElement.textContent = noteTokens + " tokens";

		const removeButton = selectedNoteBox.createEl("button");
		removeButton.addClass("remove-button");
		setIcon(removeButton, "x");
		setTooltip(removeButton, "Remove");
		removeButton.addEventListener("click", () => {
			this.selectedNotes.delete(note.path);
			this.notesContainer.removeChild(selectedNoteBox);
			this.notePaths.push(note.path);
			this.promptTokens -= noteTokens;
			this.tokenSection.textContent = "Prompt tokens: " + this.promptTokens;

			if (this.selectedNotes.size === 0) {
				this.clearButton.disabled = true;
				this.generateButton.disabled = true;
			}
		});

		this.promptTokens += noteTokens;
		this.tokenSection.textContent = "Prompt tokens: " + this.promptTokens;
	}

	private displayFolder(folder: TFolder): void {
		this.clearButton.disabled = false;
		this.generateButton.disabled = false;

		const selectedFolderBox = this.notesContainer.createDiv("notes-container-element");

		if (folder.path === "/") {
			selectedFolderBox.textContent = this.app.vault.getName() + " (Vault)";
		} else {
			this.plugin.settings.showFolderPath ?
				selectedFolderBox.textContent = folder.path : selectedFolderBox.textContent = folder.name;
		}

		const noteTokensElement = selectedFolderBox.createDiv("note-tokens");
		const noteTokens = this.countNoteTokens(this.selectedNotes.get(folder.path));
		noteTokensElement.textContent = noteTokens + " tokens";

		const removeButton = selectedFolderBox.createEl("button");
		removeButton.addClass("remove-button");
		setIcon(removeButton, "x");
		setTooltip(removeButton, "Remove");
		removeButton.addEventListener("click", () => {
			this.selectedNotes.delete(folder.path);
			this.notesContainer.removeChild(selectedFolderBox);
			this.folderPaths.push(folder.path);
			this.promptTokens -= noteTokens;
			this.tokenSection.textContent = "Prompt tokens: " + this.promptTokens;

			if (this.selectedNotes.size === 0) {
				this.clearButton.disabled = true;
				this.generateButton.disabled = true;
			}
		});

		this.promptTokens += noteTokens;
		this.tokenSection.textContent = "Prompt tokens: " + this.promptTokens;
	}

	private countNoteTokens(noteContents: string | undefined): number {
		if (typeof noteContents === "string") {
			return Math.round(noteContents.length / 4);
		} else {
			return 0;
		}
	}

	private loadNoteContents(): string[] {
		const noteContents: string[] = [];

		for (const noteContent of this.selectedNotes.values()) {
			noteContents.push(noteContent);
		}

		return noteContents;
	}

}
