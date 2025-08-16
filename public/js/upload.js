// Upload Page with Drag & Drop Functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;
    
    await initializeUpload();
    setupDragAndDrop();
    setupFileInput();
    setupUploadQueue();
    setupTransformationTools();
});

let uploadQueue = [];
let isUploading = false;

async function initializeUpload() {
    // Update auth UI
    await themeManager.updateAuthUI();
    
    // Check credits
    try {
        const creditInfo = await apiHelpers.getCredits();
        if (creditInfo.credit_balance === 0) {
            toast.warning('You have no credits remaining. Upload will create original images only.');
        }
    } catch (error) {
        console.error('Failed to check credits:', error);
    }
}

function setupDragAndDrop() {
    const uploadZone = document.getElementById('uploadZone');
    if (!uploadZone) return;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    uploadZone.addEventListener('drop', handleDrop, false);
    
    // Handle click to browse
    uploadZone.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.classList.add('drag-over');
}

function unhighlight(e) {
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }
    
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }
}

function handleFiles(files) {
    const fileArray = Array.from(files);
    const validFiles = [];
    
    fileArray.forEach(file => {
        const validation = utils.validateFile(file);
        
        if (validation.valid) {
            validFiles.push(file);
        } else {
            validation.errors.forEach(error => toast.error(error));
        }
    });
    
    if (validFiles.length > 0) {
        addFilesToQueue(validFiles);
    }
}

function addFilesToQueue(files) {
    files.forEach(file => {
        const queueItem = {
            id: utils.generateId(),
            file: file,
            title: file.name,
            status: 'pending',
            progress: 0,
            preview: null,
            uploadedImage: null
        };
        
        // Generate preview for images
        if (file.type.startsWith('image/')) {
            generatePreview(file, queueItem);
        }
        
        uploadQueue.push(queueItem);
    });
    
    updateQueueDisplay();
    showUploadQueue();
}

function generatePreview(file, queueItem) {
    const reader = new FileReader();
    reader.onload = (e) => {
        queueItem.preview = e.target.result;
        updateQueueItemDisplay(queueItem.id);
    };
    reader.readAsDataURL(file);
}

function setupUploadQueue() {
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    
    if (uploadAllBtn) {
        uploadAllBtn.addEventListener('click', uploadAllFiles);
    }
    
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', clearQueue);
    }
}

function updateQueueDisplay() {
    const queueList = document.getElementById('queueList');
    if (!queueList) return;
    
    if (uploadQueue.length === 0) {
        hideUploadQueue();
        return;
    }
    
    const queueHTML = uploadQueue.map(item => createQueueItemHTML(item)).join('');
    queueList.innerHTML = queueHTML;
    
    // Setup individual item events
    setupQueueItemEvents();
}

function createQueueItemHTML(item) {
    const previewHTML = item.preview 
        ? `<img src="${item.preview}" alt="Preview" class="queue-preview">`
        : `<div class="queue-preview-placeholder">📄</div>`;
    
    const statusIcon = {
        'pending': '⏳',
        'uploading': '⬆️',
        'completed': '✅',
        'error': '❌'
    }[item.status];
    
    return `
        <div class="queue-item" data-item-id="${item.id}">
            <div class="queue-preview-container">
                ${previewHTML}
            </div>
            <div class="queue-info">
                <div class="queue-title">
                    <input type="text" class="queue-title-input" value="${utils.escapeHTML(item.title)}" ${item.status === 'uploading' ? 'disabled' : ''}>
                </div>
                <div class="queue-meta">
                    <span class="queue-size">${utils.formatFileSize(item.file.size)}</span>
                    <span class="queue-status">${statusIcon} ${utils.capitalize(item.status)}</span>
                </div>
                <div class="queue-progress ${item.status === 'uploading' ? '' : 'hidden'}">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${item.progress}%"></div>
                    </div>
                    <span class="progress-text">${item.progress}%</span>
                </div>
            </div>
            <div class="queue-actions">
                <button class="btn btn-small btn-outline remove-item" data-action="remove" ${item.status === 'uploading' ? 'disabled' : ''}>
                    Remove
                </button>
            </div>
        </div>
    `;
}

function setupQueueItemEvents() {
    // Remove item buttons
    const removeButtons = document.querySelectorAll('.remove-item');
    removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemId = e.target.closest('.queue-item').getAttribute('data-item-id');
            removeFromQueue(itemId);
        });
    });
    
    // Title inputs
    const titleInputs = document.querySelectorAll('.queue-title-input');
    titleInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const itemId = e.target.closest('.queue-item').getAttribute('data-item-id');
            const item = uploadQueue.find(i => i.id === itemId);
            if (item) {
                item.title = e.target.value;
            }
        });
    });
}

function updateQueueItemDisplay(itemId) {
    const item = uploadQueue.find(i => i.id === itemId);
    if (!item) return;
    
    const itemEl = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemEl) {
        itemEl.outerHTML = createQueueItemHTML(item);
        setupQueueItemEvents();
    }
}

function removeFromQueue(itemId) {
    uploadQueue = uploadQueue.filter(item => item.id !== itemId);
    updateQueueDisplay();
}

function clearQueue() {
    uploadQueue = uploadQueue.filter(item => item.status === 'uploading');
    updateQueueDisplay();
}

function showUploadQueue() {
    const uploadQueue = document.getElementById('uploadQueue');
    if (uploadQueue) {
        uploadQueue.classList.remove('hidden');
    }
}

function hideUploadQueue() {
    const uploadQueue = document.getElementById('uploadQueue');
    if (uploadQueue) {
        uploadQueue.classList.add('hidden');
    }
}

async function uploadAllFiles() {
    if (isUploading) return;
    
    const pendingFiles = uploadQueue.filter(item => item.status === 'pending');
    if (pendingFiles.length === 0) {
        toast.warning('No files to upload');
        return;
    }
    
    isUploading = true;
    
    // Show progress modal
    showProgressModal();
    
    let completed = 0;
    let failed = 0;
    
    for (const item of pendingFiles) {
        try {
            await uploadFile(item);
            completed++;
        } catch (error) {
            console.error('Upload failed:', error);
            item.status = 'error';
            failed++;
        }
        
        updateProgressModal(completed + failed, pendingFiles.length);
        updateQueueItemDisplay(item.id);
    }
    
    isUploading = false;
    hideProgressModal();
    
    // Show results
    if (completed > 0) {
        toast.success(`Successfully uploaded ${completed} file${completed > 1 ? 's' : ''}`);
        showUploadedImages();
    }
    
    if (failed > 0) {
        toast.error(`Failed to upload ${failed} file${failed > 1 ? 's' : ''}`);
    }
}

async function uploadFile(item) {
    item.status = 'uploading';
    item.progress = 0;
    updateQueueItemDisplay(item.id);
    
    try {
        // Simulate progress
        const progressInterval = setInterval(() => {
            if (item.progress < 90) {
                item.progress += Math.random() * 20;
                updateQueueItemDisplay(item.id);
            }
        }, 100);
        
        // Upload file
        const uploadedImage = await api.uploadFile(item.file, item.title);
        
        clearInterval(progressInterval);
        item.progress = 100;
        item.status = 'completed';
        item.uploadedImage = uploadedImage;
        
        updateQueueItemDisplay(item.id);
        
    } catch (error) {
        item.status = 'error';
        throw error;
    }
}

function showProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideProgressModal() {
    const modal = document.getElementById('progressModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function updateProgressModal(completed, total) {
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const progressCount = document.getElementById('progressCount');
    const progressPercent = document.getElementById('progressPercent');
    
    const percentage = Math.round((completed / total) * 100);
    
    if (progressText) {
        progressText.textContent = completed === total ? 'Upload complete!' : 'Uploading files...';
    }
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (progressCount) {
        progressCount.textContent = `${completed}/${total}`;
    }
    
    if (progressPercent) {
        progressPercent.textContent = `${percentage}%`;
    }
}

function setupTransformationTools() {
    // Show transformation tools after successful upload
    const toolApplyButtons = document.querySelectorAll('.tool-apply');
    
    toolApplyButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const transformationType = btn.getAttribute('data-type');
            await applyTransformationToUploaded(transformationType);
        });
    });
}

async function applyTransformationToUploaded(transformationType) {
    const uploadedImages = uploadQueue.filter(item => item.status === 'completed' && item.uploadedImage);
    
    if (uploadedImages.length === 0) {
        toast.warning('No uploaded images to transform');
        return;
    }
    
    const cost = APP_CONFIG.TRANSFORMATION_COSTS[transformationType];
    const totalCost = cost * uploadedImages.length;
    
    try {
        const creditInfo = await apiHelpers.getCredits();
        if (creditInfo.credit_balance < totalCost) {
            toast.error(`Insufficient credits. Need ${totalCost}, have ${creditInfo.credit_balance}`);
            return;
        }
    } catch (error) {
        console.error('Failed to check credits:', error);
        toast.error('Failed to check credits');
        return;
    }
    
    const confirmed = await modal.confirm(
        'Apply Transformation',
        `Apply ${utils.formatTransformationType(transformationType)} to ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}? This will cost ${totalCost} credit${totalCost > 1 ? 's' : ''}.`
    );
    
    if (!confirmed) return;
    
    // Apply transformations
    for (const item of uploadedImages) {
        try {
            await api.applyTransformation(item.uploadedImage.id, transformationType);
            toast.success(`Applied ${utils.formatTransformationType(transformationType)} to ${item.title}`);
        } catch (error) {
            console.error('Transformation failed:', error);
            toast.error(`Failed to transform ${item.title}`);
        }
    }
    
    // Refresh credits
    await themeManager.updateCredits();
}

function showUploadedImages() {
    const uploadedImages = uploadQueue.filter(item => item.status === 'completed' && item.uploadedImage);
    
    if (uploadedImages.length === 0) return;
    
    const uploadedImagesSection = document.getElementById('uploadedImages');
    const imagesGrid = document.getElementById('imagesGrid');
    
    if (!uploadedImagesSection || !imagesGrid) return;
    
    const imagesHTML = uploadedImages.map(item => `
        <div class="uploaded-image">
            <img src="${item.uploadedImage.secure_url}" alt="${utils.escapeHTML(item.title)}">
            <div class="image-title">${utils.escapeHTML(item.title)}</div>
            <div class="image-actions">
                <a href="${item.uploadedImage.secure_url}" class="btn btn-small btn-outline" download="${item.title}">Download</a>
                <a href="/gallery.html?image=${item.uploadedImage.id}" class="btn btn-small btn-primary">View in Gallery</a>
            </div>
        </div>
    `).join('');
    
    imagesGrid.innerHTML = imagesHTML;
    uploadedImagesSection.classList.remove('hidden');
    
    // Show transformation tools
    const transformationTools = document.getElementById('transformationTools');
    if (transformationTools) {
        transformationTools.classList.remove('hidden');
    }
}

// Handle page unload during upload
window.addEventListener('beforeunload', (e) => {
    if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
        return e.returnValue;
    }
});
