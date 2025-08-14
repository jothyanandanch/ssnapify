import { CONFIG, TOOL_CONFIG, ImageTool } from './config.js';
import { showToast } from './utils.js';

class HomePage {
    private toolCards!: NodeListOf<HTMLElement>;
    private universalUpload!: HTMLElement;
    private quickDropZone!: HTMLElement;
    private quickFileInput!: HTMLInputElement;
    private selectedTool: ImageTool | null = null;

    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.initializeAnimations();
    }

    private initializeElements(): void {
        this.toolCards = document.querySelectorAll('.tool-card[data-tool]');
        this.universalUpload = document.getElementById('universalUpload')!;
        this.quickDropZone = document.getElementById('quickDropZone')!;
        this.quickFileInput = document.getElementById('quickFileInput')! as HTMLInputElement;
    }

    private setupEventListeners(): void {
        this.toolCards.forEach(card => {
            card.addEventListener('click', this.handleToolCardClick.bind(this));
            card.addEventListener('mouseenter', this.handleToolCardHover.bind(this));
            card.addEventListener('mouseleave', this.handleToolCardLeave.bind(this));
        });

        document.getElementById('closeUpload')?.addEventListener('click', this.closeUploadModal.bind(this));
        this.universalUpload.addEventListener('click', (e) => {
            if (e.target === this.universalUpload) this.closeUploadModal();
        });

        this.setupQuickUpload();
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }

    private handleToolCardClick(e: Event): void {
        const card = e.currentTarget as HTMLElement;
        const tool = card.dataset.tool as ImageTool;
        if (!tool || !TOOL_CONFIG[tool]) return;
        this.selectedTool = tool;
        this.showUploadModal(tool);

        card.classList.add('animate-scale-in-bounce');
        setTimeout(() => card.classList.remove('animate-scale-in-bounce'), 600);
    }

    private handleToolCardHover(e: Event): void {
        const card = e.currentTarget as HTMLElement;
        const tooltip = document.createElement('div');
        tooltip.className = 'tool-tooltip glass-effect';
        const tool = card.dataset.tool as ImageTool;
        const toolConfig = TOOL_CONFIG[tool];
        tooltip.innerHTML = `
            ${toolConfig.icon}
            ${toolConfig.name}
            ${toolConfig.description}
            ${toolConfig.credits} credits per image
        `;
        card.appendChild(tooltip);
        tooltip.style.position = 'absolute';
        tooltip.style.top = '-120px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.zIndex = '1000';
        tooltip.classList.add('animate-fade-in');
    }

    private handleToolCardLeave(e: Event): void {
        const card = e.currentTarget as HTMLElement;
        card.querySelector('.tool-tooltip')?.remove();
    }

    private showUploadModal(tool: ImageTool): void {
        const toolConfig = TOOL_CONFIG[tool];
        const selectedToolInfo = document.getElementById('selectedToolInfo')!;
        selectedToolInfo.innerHTML = `
            ${toolConfig.icon}
            ${toolConfig.name}
            ${toolConfig.description}
            ${toolConfig.credits} credits
        `;
        this.universalUpload.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    private closeUploadModal(): void {
        this.universalUpload.classList.remove('active');
        document.body.style.overflow = '';
        this.selectedTool = null;
    }

    private setupQuickUpload(): void {
        this.quickDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.quickDropZone.classList.add('drag-over');
        });
        this.quickDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.quickDropZone.classList.remove('drag-over');
        });
        this.quickDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.quickDropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer?.files || []);
            this.handleQuickUpload(files);
        });
        this.quickDropZone.addEventListener('click', () => this.quickFileInput.click());
        this.quickFileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const files = Array.from(target.files || []);
            this.handleQuickUpload(files);
        });
    }

    private handleQuickUpload(files: File[]): void {
        if (files.length === 0) return;
        if (!this.selectedTool) {
            showToast('Please select a tool first', 'warning');
            return;
        }
        const params = new URLSearchParams({
            tool: this.selectedTool,
            files: files.length.toString()
        });
        const fileData = files.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));
        sessionStorage.setItem('pendingFiles', JSON.stringify(fileData));
        window.location.href = `upload.html?${params.toString()}`;
    }

    private handleKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape' && this.universalUpload.classList.contains('active')) {
            this.closeUploadModal();
        }
        if (e.key >= '1' && e.key <= '6') {
            const toolIndex = parseInt(e.key) - 1;
            (this.toolCards[toolIndex] as HTMLElement)?.click();
        }
    }

    private handleScroll(): void {
        const scrollY = window.scrollY;
        document.querySelectorAll('.floating-shapes .shape').forEach((shape, index) => {
            const speed = 0.5 + (index * 0.2);
            (shape as HTMLElement).style.transform = `translateY(${scrollY * speed}px)`;
        });
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (scrollY > 100) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        }
    }

    private initializeAnimations(): void {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('animate-fade-in');
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        this.toolCards.forEach((card, index) => {
            observer.observe(card);
            (card as HTMLElement).style.animationDelay = `${index * 100}ms`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new HomePage());
