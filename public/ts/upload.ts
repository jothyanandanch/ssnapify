import { api, APIError } from './api.js';
import { CONFIG, TOOL_CONFIG, ImageTool } from './config.js';
import { showToast, formatFileSize, createProgressBar } from './utils.js';
import { ensureLoggedIn } from './auth.js';
type AllowedExt = 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif';

function toAllowedExt(ext: string | undefined): AllowedExt | null {
if (!ext) return null;
const e = ext.toLowerCase();
if (e === 'jpg' || e === 'jpeg' || e === 'png' || e === 'webp' || e === 'gif') return e;
return null;
}


class AdvancedUploader {
    private dropZone!: HTMLElement;
    private fileInput!: HTMLInputElement;
    private previewGrid!: HTMLElement;
    private uploadBtn!: HTMLButtonElement;
    private files: Map<string, File> = new Map();
    private selectedTool: ImageTool | null = null;

    constructor() {
        this.initElements();
        this.setupEvents();
    }

    private initElements(): void {
        this.dropZone = document.getElementById('dropZone')!;
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.previewGrid = document.getElementById('filePreviewGrid')!;
        this.uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
    }

    private setupEvents(): void {
        this.dropZone.addEventListener('dragover', e => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
        this.dropZone.addEventListener('dragleave', e => { e.preventDefault(); this.dropZone.classList.remove('drag-over'); });
        this.dropZone.addEventListener('drop', e => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            this.handleFiles(Array.from(e.dataTransfer?.files || []));
        });
        this.fileInput.addEventListener('change', e => {
            const f = (e.target as HTMLInputElement).files;
            if (f) this.handleFiles(Array.from(f));
        });
        this.uploadBtn.addEventListener('click', () => this.uploadAll());
    }

    private handleFiles(files: File[]): void {
        for (const file of files) {
            if (!this.validateFile(file)) continue;
            this.files.set(file.name, file);
            this.addPreview(file);
        }
    }

    private validateFile(file: File): boolean {
        const rawExt = file.name.split('.').pop();
        const ext = toAllowedExt(rawExt);
        if (!ext || !CONFIG.SUPPORTED_FORMATS.includes(ext)) {
            showToast(`Unsupported format: ${ext}`, 'error');
            return false;
        }
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            showToast(`File too large: ${formatFileSize(file.size)}`, 'error');
            return false;
        }
        return true;
    }

    private addPreview(file: File): void {
        const item = document.createElement('div');
        item.innerHTML = `
            <div>${file.name}</div>
            ${formatFileSize(file.size)}
            ${createProgressBar(0)}
        `;
        this.previewGrid.appendChild(item);
    }

    private async uploadAll(): Promise<void> {
        for (const file of this.files.values()) {
            const formData = new FormData();
            formData.append('file', file);
            await api.post('/images', formData, false);
        }
        showToast('Upload complete', 'success');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ensureLoggedIn();
    (window as any).uploader = new AdvancedUploader();
});
