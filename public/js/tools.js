// Shared Tool Page Functionality (continued)
document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;
    
    await initializeTool();
    setupToolUpload();
    setupPromptHandling();
    await checkCredits();
});

let toolConfig = window.TOOL_CONFIG || {};
let uploadedImages = [];
let processingImages = new Map();

async function initializeTool() {
    // Update auth UI
    await themeManager.updateAuthUI();
    
    // Validate tool configuration
    if (!toolConfig.type || !toolConfig.endpoint) {
        toast.error('Tool configuration error');
        return;
    }
    
    console.log(`Initialized ${toolConfig.name} tool`);
}

async function checkCredits() {
    try {
        const creditInfo = await apiHelpers.getCredits();
        const cost = toolConfig.cost || 1;
        
        if (creditInfo.credit_balance < cost) {
            toast.warning(`Insufficient credits. This tool requires ${cost} credit${cost > 1 ? 's' : ''}, you have ${creditInfo.credit_balance}.`);
        }
    } catch (error) {
        console.error('Failed to check credits:', error);
    }
}

function setupToolUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    
    if (!uploadZone || !fileInput) return;
    
    // Drag and drop functionality
    setupDragAndDrop(uploadZone, fileInput);
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(Array.from(e.target.files));
    });
    
    // Browse button
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }
    
    // Click zone to browse
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });
}

function setupDragAndDrop(uploadZone, fileInput) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.remove('drag-over');
        });
    });
    
    // Handle drop
    uploadZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFiles(files) {
    const validFiles = files.filter(file => {
        const validation = utils.validateFile(file);
        if (!validation.valid) {
            validation.errors.forEach(error => toast.error(error));
            return false;
        }
        return true;
    });
    
    if (validFiles.length > 0) {
        processFiles(validFiles);
    }
}

async function processFiles(files) {
    // Hide upload section, show processing
    const uploadSection = document.getElementById('uploadSection');
    const processingSection = document.getElementById('processingSection');
    
    if (uploadSection) uploadSection.classList.add('hidden');
    if (processingSection) processingSection.classList.remove('hidden');
    
    // Process each file
    for (const file of files) {
        await processFile(file);
    }
}

async function processFile(file) {
    const processingId = utils.generateId();
    
    try {
        // Add to processing display
        addProcessingItem(processingId, file);
        
        // Upload file first
        updateProcessingStatus(processingId, 'Uploading...', 10);
        const uploadedImage = await api.uploadFile(file, file.name);
        
        updateProcessingStatus(processingId, 'Processing with AI...', 50);
        
        // Apply transformation if prompt is required and available
        let prompt = null;
        if (toolConfig.requiresPrompt) {
            prompt = getPromptValue();
            if (!prompt) {
                // Show prompt section if not already visible
                showPromptSection();
                updateProcessingStatus(processingId, 'Waiting for prompt...', 50);
                return;
            }
        }
        
        // Apply transformation
        const transformedImage = await api.applyTransformation(
            uploadedImage.id, 
            toolConfig.type, 
            prompt
        );
        
        updateProcessingStatus(processingId, 'Complete!', 100);
        
        // Add to results
        addToResults(transformedImage, uploadedImage);
        
        // Remove from processing after delay
        setTimeout(() => {
            removeProcessingItem(processingId);
        }, 2000);
        
    } catch (error) {
        console.error('Processing failed:', error);
        updateProcessingStatus(processingId, `Error: ${error.message}`, 0);
        toast.error(`Failed to process ${file.name}: ${error.message}`);
    }
}

function addProcessingItem(id, file) {
    const processingGrid = document.getElementById('processingGrid');
    if (!processingGrid) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const itemHTML = `
            <div class="processing-item" data-processing-id="${id}">
                <img src="${e.target.result}" alt="Processing" class="processing-preview">
                <div class="processing-info">
                    <div class="processing-name">${utils.escapeHTML(file.name)}</div>
                    <div class="processing-status">Preparing...</div>
                    <div class="processing-progress">
                        <div class="processing-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
        
        processingGrid.insertAdjacentHTML('beforeend', itemHTML);
    };
    
    reader.readAsDataURL(file);
}

function updateProcessingStatus(id, status, progress) {
    const item = document.querySelector(`[data-processing-id="${id}"]`);
    if (!item) return;
    
    const statusEl = item.querySelector('.processing-status');
    const progressBar = item.querySelector('.processing-progress-bar');
    
    if (statusEl) statusEl.textContent = status;
    if (progressBar) progressBar.style.width = `${progress}%`;
}

function removeProcessingItem(id) {
    const item = document.querySelector(`[data-processing-id="${id}"]`);
    if (item) {
        item.remove();
    }
    
    // Hide processing section if empty
    const processingGrid = document.getElementById('processingGrid');
    if (processingGrid && processingGrid.children.length === 0) {
        const processingSection = document.getElementById('processingSection');
        if (processingSection) processingSection.classList.add('hidden');
    }
}

function setupPromptHandling() {
    // Setup example tags
    const exampleTags = document.querySelectorAll('.example-tag');
    exampleTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const prompt = tag.getAttribute('data-prompt');
            const promptInput = getPromptInput();
            if (promptInput && prompt) {
                promptInput.value = prompt;
                promptInput.focus();
            }
        });
    });
    
    // Setup prompt input validation
    const promptInput = getPromptInput();
    if (promptInput) {
        promptInput.addEventListener('input', () => {
            validatePrompt();
        });
    }
}

function getPromptInput() {
    return document.getElementById('backgroundPrompt') || 
           document.getElementById('fillPrompt') || 
           document.querySelector('.prompt-textarea');
}

function getPromptValue() {
    const promptInput = getPromptInput();
    return promptInput ? promptInput.value.trim() : null;
}

function showPromptSection() {
    const promptSection = document.getElementById('promptSection');
    if (promptSection) {
        promptSection.classList.remove('hidden');
        utils.scrollTo(promptSection);
    }
}

function validatePrompt() {
    const promptInput = getPromptInput();
    if (!promptInput) return true;
    
    const prompt = promptInput.value.trim();
    
    if (toolConfig.requiresPrompt && !prompt) {
        return false;
    }
    
    if (prompt.length > 500) {
        toast.warning('Prompt is too long. Please keep it under 500 characters.');
        return false;
    }
    
    return true;
}

function addToResults(transformedImage, originalImage) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    
    if (!resultsSection || !resultsGrid) return;
    
    // Show results section
    resultsSection.classList.remove('hidden');
    
    // Create result item
    const resultHTML = `
        <div class="result-item">
            <div class="result-preview">
                <img src="${transformedImage.secure_url}" alt="${utils.escapeHTML(transformedImage.title)}" class="result-image">
                <div class="result-overlay">
                    <div class="result-actions">
                        <button class="btn btn-small btn-primary view-result" data-url="${transformedImage.secure_url}">View</button>
                        <a href="${transformedImage.secure_url}" class="btn btn-small btn-outline" download="${transformedImage.title}">Download</a>
                    </div>
                </div>
            </div>
            <div class="result-info">
                <div class="result-title">${utils.escapeHTML(transformedImage.title)}</div>
                <div class="result-meta">
                    <span class="result-type">${utils.formatTransformationType(transformedImage.transformation_type)}</span>
                    <span class="result-time">${utils.formatRelativeTime(transformedImage.created_at)}</span>
                </div>
            </div>
        </div>
    `;
    
    resultsGrid.insertAdjacentHTML('beforeend', resultHTML);
    
    // Setup result interactions
    setupResultEvents();
    
    // Update credits display
    themeManager.updateCredits();
    
    // Scroll to results
    utils.scrollTo(resultsSection);
}

function setupResultEvents() {
    // View buttons
    const viewButtons = document.querySelectorAll('.view-result');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const imageUrl = btn.getAttribute('data-url');
            if (imageUrl) {
                window.open(imageUrl, '_blank');
            }
        });
    });
}

// Add tool-specific CSS
const toolStyles = document.createElement('style');
toolStyles.textContent = `
    .drag-over {
        background-color: var(--primary-light) !important;
        border-color: var(--primary-color) !important;
        transform: scale(1.02);
    }
    
    .processing-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background-color: var(--bg-secondary);
        border-radius: var(--border-radius);
        margin-bottom: 1rem;
    }
    
    .processing-preview {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: var(--border-radius);
        flex-shrink: 0;
    }
    
    .processing-info {
        flex: 1;
    }
    
    .processing-name {
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
    }
    
    .processing-status {
        color: var(--text-secondary);
        font-size: 0.875rem;
        margin-bottom: 0.5rem;
    }
    
    .processing-progress {
        width: 100%;
        height: 0.5rem;
        background-color: var(--bg-primary);
        border-radius: var(--border-radius-full);
        overflow: hidden;
    }
    
    .processing-progress-bar {
        height: 100%;
        background-color: var(--primary-color);
        transition: width var(--transition-normal);
        border-radius: var(--border-radius-full);
    }
`;

document.head.appendChild(toolStyles);
