import { api, APIError } from './api.js';
import { CONFIG, TOOL_CONFIG, ImageTool } from './config.js';
import { ImageAsset } from './types.js';
import { showToast, formatDate } from './utils.js';
import { ensureLoggedIn, isAdmin, getUser } from './auth.js';

class GalleryManager {
    private images: ImageAsset[] = [];
    private selectedImages: Set<string> = new Set();
    private currentFilter: string = 'all';

    private gridContainer!: HTMLElement;
    private filterButtons!: NodeListOf<HTMLButtonElement>;
    private selectAllBtn!: HTMLButtonElement;
    private deleteSelectedBtn!: HTMLButtonElement;
    private searchInput!: HTMLInputElement;
    private dateFromInput!: HTMLInputElement;
    private dateToInput!: HTMLInputElement;

    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadImages();
    }

    private initializeElements(): void {
        this.gridContainer = document.getElementById('galleryGrid')!;
        this.filterButtons = document.querySelectorAll('.filter-btn') as NodeListOf<HTMLButtonElement>;
        this.selectAllBtn = document.getElementById('selectAll')! as HTMLButtonElement;
        this.deleteSelectedBtn = document.getElementById('deleteSelected')! as HTMLButtonElement;
        this.searchInput = document.getElementById('searchInput')! as HTMLInputElement;
        this.dateFromInput = document.getElementById('dateFrom')! as HTMLInputElement;
        this.dateToInput = document.getElementById('dateTo')! as HTMLInputElement;
    }

    private setupEventListeners(): void {
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => this.handleFilterChange(btn));
        });

        this.selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        this.deleteSelectedBtn.addEventListener('click', () => this.deleteSelectedImages());

        this.searchInput.addEventListener('input', () => this.applyFilters());
        this.dateFromInput.addEventListener('change', () => this.applyFilters());
        this.dateToInput.addEventListener('change', () => this.applyFilters());

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.toggleSelectAll();
            }
            if (e.key === 'Delete' && this.selectedImages.size > 0) {
                this.deleteSelectedImages();
            }
        });
    }

    private async loadImages(): Promise<void> {
        try {
            const params: Record<string, string> = {};
            if (this.dateFromInput.value) params.from = this.dateFromInput.value;
            if (this.dateToInput.value) params.to = this.dateToInput.value;

            this.images = await api.get('/images', params);
            this.renderImages();
            this.updateStats();
        } catch (error) {
            console.error('Failed to load images:', error);
            showToast('Failed to load images', 'error');
        }
    }

    private renderImages(): void {
        if (this.images.length === 0) {
            this.gridContainer.innerHTML = `
                <div class="empty">
                    No images found<br>
                    <a href="upload.html">Upload some images to get started!</a>
                </div>
            `;
            return;
        }

        const filteredImages = this.getFilteredImages();
        this.gridContainer.innerHTML = filteredImages.map(image => `
            <div class="image-card" data-image-id="${image.id}">
                <div class="thumb">
                    <span class="badge">${this.getTransformationLabel(image.transformation_type)}</span>
                    <img src="${image.secure_url}" alt="${image.title || ''}">
                </div>
                <div class="meta">
                    <div>${image.title || 'Untitled'}</div>
                    <div class="small">${formatDate(image.created_at)}</div>
                </div>
            </div>
        `).join('');

        const imageCards = this.gridContainer.querySelectorAll('.image-card');
        imageCards.forEach((card, index) => {
            const element = card as HTMLElement;
            element.style.animationDelay = `${index * 100}ms`;
            element.classList.add('animate-fade-in');
        });
    }

    private getFilteredImages(): ImageAsset[] {
        return this.images.filter(image => {
            if (this.currentFilter !== 'all') {
                const imageType = image.transformation_type || 'original';
                if (imageType !== this.currentFilter) return false;
            }
            const searchTerm = this.searchInput.value.toLowerCase().trim();
            if (searchTerm) {
                const title = image.title?.toLowerCase() || '';
                if (!title.includes(searchTerm)) return false;
            }
            return true;
        });
    }

    private getTransformationLabel(type?: string): string {
        if (!type) return 'Original';
        return TOOL_CONFIG[type as ImageTool]?.name || type;
    }

    private handleFilterChange(button: HTMLButtonElement): void {
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        this.currentFilter = button.dataset.filter || 'all';
        this.renderImages();
    }

    private applyFilters(): void {
        this.renderImages();
    }

    private toggleSelectAll(): void {
        const filteredImages = this.getFilteredImages();
        if (this.selectedImages.size === filteredImages.length) {
            this.selectedImages.clear();
        } else {
            filteredImages.forEach(image => this.selectedImages.add(image.id));
        }
        this.renderImages();
        this.updateSelectionUI();
    }

    public toggleImageSelection(imageId: string): void {
        if (this.selectedImages.has(imageId)) {
            this.selectedImages.delete(imageId);
        } else {
            this.selectedImages.add(imageId);
        }
        this.updateSelectionUI();
        this.updateImageCardSelection(imageId);
    }

    private updateImageCardSelection(imageId: string): void {
        const card = document.querySelector(`[data-image-id="${imageId}"]`) as HTMLElement;
        if (!card) return;
        if (this.selectedImages.has(imageId)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }

    private updateSelectionUI(): void {
        const selectedCount = this.selectedImages.size;
        this.deleteSelectedBtn.style.display = selectedCount > 0 ? 'block' : 'none';
        this.selectAllBtn.textContent = selectedCount > 0 ? `Selected (${selectedCount})` : 'Select All';
    }

    private updateStats(): void {
        const totalImages = this.images.length;
        const totalElement = document.getElementById('totalImages');
        if (totalElement) totalElement.textContent = totalImages.toString();

        const transformationCounts = this.images.reduce((acc, image) => {
            const type = image.transformation_type || 'original';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(transformationCounts).forEach(([type, count]) => {
            const element = document.getElementById(`${type}Count`);
            if (element) element.textContent = count.toString();
        });
    }

    private async deleteSelectedImages(): Promise<void> {
        if (this.selectedImages.size === 0) return;
        if (!confirm(`Delete ${this.selectedImages.size} image(s)? This cannot be undone.`)) return;

        try {
            const deletePromises = Array.from(this.selectedImages).map(id => this.deleteImage(id));
            await Promise.all(deletePromises);
            showToast(`Deleted ${this.selectedImages.size} images`, 'success');
            this.selectedImages.clear();
            await this.loadImages();
        } catch {
            showToast('Some images failed to delete', 'error');
        }
    }

    private async deleteImage(imageId: string): Promise<void> {
        await api.delete(`/images/${imageId}`);
        this.images = this.images.filter(img => img.id !== imageId);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ensureLoggedIn();
    (window as any).gallery = new GalleryManager();
});
