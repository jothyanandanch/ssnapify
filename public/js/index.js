import { TOOL_CONFIG } from './config.js';
import { showToast } from './utils.js';
class HomePage {
    constructor() {
        this.selectedTool = null;
        this.initializeElements();
        this.setupEventListeners();
        this.initializeAnimations();
    }
    initializeElements() {
        this.toolCards = document.querySelectorAll('.tool-card[data-tool]');
        this.universalUpload = document.getElementById('universalUpload');
        this.quickDropZone = document.getElementById('quickDropZone');
        this.quickFileInput = document.getElementById('quickFileInput');
    }
    setupEventListeners() {
        var _a;
        this.toolCards.forEach(card => {
            card.addEventListener('click', this.handleToolCardClick.bind(this));
            card.addEventListener('mouseenter', this.handleToolCardHover.bind(this));
            card.addEventListener('mouseleave', this.handleToolCardLeave.bind(this));
        });
        (_a = document.getElementById('closeUpload')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', this.closeUploadModal.bind(this));
        this.universalUpload.addEventListener('click', (e) => {
            if (e.target === this.universalUpload)
                this.closeUploadModal();
        });
        this.setupQuickUpload();
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }
    handleToolCardClick(e) {
        const card = e.currentTarget;
        const tool = card.dataset.tool;
        if (!tool || !TOOL_CONFIG[tool])
            return;
        this.selectedTool = tool;
        this.showUploadModal(tool);
        card.classList.add('animate-scale-in-bounce');
        setTimeout(() => card.classList.remove('animate-scale-in-bounce'), 600);
    }
    handleToolCardHover(e) {
        const card = e.currentTarget;
        const tooltip = document.createElement('div');
        tooltip.className = 'tool-tooltip glass-effect';
        const tool = card.dataset.tool;
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
    handleToolCardLeave(e) {
        var _a;
        const card = e.currentTarget;
        (_a = card.querySelector('.tool-tooltip')) === null || _a === void 0 ? void 0 : _a.remove();
    }
    showUploadModal(tool) {
        const toolConfig = TOOL_CONFIG[tool];
        const selectedToolInfo = document.getElementById('selectedToolInfo');
        selectedToolInfo.innerHTML = `
            ${toolConfig.icon}
            ${toolConfig.name}
            ${toolConfig.description}
            ${toolConfig.credits} credits
        `;
        this.universalUpload.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    closeUploadModal() {
        this.universalUpload.classList.remove('active');
        document.body.style.overflow = '';
        this.selectedTool = null;
    }
    setupQuickUpload() {
        this.quickDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.quickDropZone.classList.add('drag-over');
        });
        this.quickDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.quickDropZone.classList.remove('drag-over');
        });
        this.quickDropZone.addEventListener('drop', (e) => {
            var _a;
            e.preventDefault();
            this.quickDropZone.classList.remove('drag-over');
            const files = Array.from(((_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.files) || []);
            this.handleQuickUpload(files);
        });
        this.quickDropZone.addEventListener('click', () => this.quickFileInput.click());
        this.quickFileInput.addEventListener('change', (e) => {
            const target = e.target;
            const files = Array.from(target.files || []);
            this.handleQuickUpload(files);
        });
    }
    handleQuickUpload(files) {
        if (files.length === 0)
            return;
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
    handleKeydown(e) {
        var _a;
        if (e.key === 'Escape' && this.universalUpload.classList.contains('active')) {
            this.closeUploadModal();
        }
        if (e.key >= '1' && e.key <= '6') {
            const toolIndex = parseInt(e.key) - 1;
            (_a = this.toolCards[toolIndex]) === null || _a === void 0 ? void 0 : _a.click();
        }
    }
    handleScroll() {
        const scrollY = window.scrollY;
        document.querySelectorAll('.floating-shapes .shape').forEach((shape, index) => {
            const speed = 0.5 + (index * 0.2);
            shape.style.transform = `translateY(${scrollY * speed}px)`;
        });
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (scrollY > 100)
                navbar.classList.add('scrolled');
            else
                navbar.classList.remove('scrolled');
        }
    }
    initializeAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        this.toolCards.forEach((card, index) => {
            observer.observe(card);
            card.style.animationDelay = `${index * 100}ms`;
        });
    }
}
document.addEventListener('DOMContentLoaded', () => new HomePage());
