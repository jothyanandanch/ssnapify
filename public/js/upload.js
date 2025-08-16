document.addEventListener('DOMContentLoaded', () => {
    // Require authentication
    if (!auth.requireAuth()) return;

    setupUpload();
});

let uploadQueue = [];
let isUploading = false;

function setupUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadAllBtn = document.getElementById('uploadAll');
    const clearQueueBtn = document.getElementById('clearQueue');

    // Setup drag and drop
    if (uploadZone && fileInput) {
        setupDragAndDrop(uploadZone, fileInput);
    }

    // File input change
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(Array.from(e.target.files));
        });
    }

    // Browse button
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    // Upload all button
    if (uploadAllBtn) {
        uploadAllBtn.addEventListener('click', uploadAllFiles);
    }

    // Clear queue button
    if (clearQueueBtn) {
        clearQueueBtn.addEventListener('click', clearQueue);
    }
}

function setupDragAndDrop(uploadZone, fileInput) {
    // Prevent default behaviors
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

    // Handle click
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFiles(files) {
    const validFiles = files.filter(file => {
        const validation = core.validateFile(file);
        if (!validation.valid) {
            validation.errors.forEach(error => {
                core.showToast(error, 'error');
            });
            return false;
        }
        return true;
    });

    if (validFiles.length > 0) {
        addFilesToQueue(validFiles);
    }
}

function addFilesToQueue(files) {
    files.forEach(file => {
        const queueItem = {
            id: generateId(),
            file: file,
            title: file.name,
            status: 'pending',
            progress: 0,
            preview: null
        };

        // Generate preview
        generatePreview(file, queueItem);
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
        ? `<img src="${item.preview}" alt="${item.title}">`
        : `<div class="file-icon">📄</div>`;

    const statusHTML = getStatusHTML(item);

    return `
        <div class="queue-item" data-id="${item.id}">
            <div class="item-preview">
                ${previewHTML}
            </div>
            <div class="item-info">
                <h4 class="item-title">${item.title}</h4>
                <p class="item-size">${core.formatFileSize(item.file.size)}</p>
                ${statusHTML}
            </div>
            <div class="item-actions">
                <button class="btn-remove" onclick="removeFromQueue('${item.id}')">×</button>
            </div>
        </div>
    `;
}

function getStatusHTML(item) {
    switch (item.status) {
        case 'pending':
            return '<div class="item-status pending">Pending</div>';
        case 'uploading':
            return `
                <div class="item-status uploading">Uploading...</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${item.progress}%"></div>
                </div>
            `;
        case 'completed':
            return '<div class="item-status completed">✅ Completed</div>';
        case 'error':
            return '<div class="item-status error">❌ Failed</div>';
        default:
            return '';
    }
}

function setupQueueItemEvents() {
    // Individual upload buttons, etc.
}

function updateQueueItemDisplay(itemId) {
    const item = uploadQueue.find(i => i.id === itemId);
    if (!item) return;

    const itemElement = document.querySelector(`[data-id="${itemId}"]`);
    if (itemElement) {
        itemElement.innerHTML = createQueueItemHTML(item).replace(/^<div[^>]*>|<\/div>$/g, '');
    }
}

async function uploadAllFiles() {
    if (isUploading) return;

    isUploading = true;
    const uploadAllBtn = document.getElementById('uploadAll');
    if (uploadAllBtn) {
        uploadAllBtn.disabled = true;
        uploadAllBtn.textContent = 'Uploading...';
    }

    const pendingItems = uploadQueue.filter(item => item.status === 'pending');
    let completedCount = 0;

    for (const item of pendingItems) {
        try {
            await uploadFile(item);
            completedCount++;
        } catch (error) {
            console.error('Upload failed:', error);
            item.status = 'error';
            updateQueueItemDisplay(item.id);
        }
    }

    isUploading = false;

    if (completedCount === pendingItems.length && completedCount > 0) {
        // All uploads successful
        showUploadSuccess();
    } else {
        // Some uploads failed
        if (uploadAllBtn) {
            uploadAllBtn.disabled = false;
            uploadAllBtn.textContent = 'Upload All';
        }
        core.showToast(`${completedCount}/${pendingItems.length} files uploaded successfully`, 'info');
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
                item.progress += 10;
                updateQueueItemDisplay(item.id);
            }
        }, 200);

        // Upload file
        const result = await core.uploadImage(item.file, item.title);

        clearInterval(progressInterval);
        item.progress = 100;
        item.status = 'completed';
        updateQueueItemDisplay(item.id);

        return result;
    } catch (error) {
        item.status = 'error';
        updateQueueItemDisplay(item.id);
        throw error;
    }
}

function removeFromQueue(itemId) {
    uploadQueue = uploadQueue.filter(item => item.id !== itemId);
    updateQueueDisplay();
}

function clearQueue() {
    uploadQueue = [];
    updateQueueDisplay();
}

function showUploadQueue() {
    const uploadQueue = document.getElementById('uploadQueue');
    if (uploadQueue) {
        uploadQueue.style.display = 'block';
    }
}

function hideUploadQueue() {
    const uploadQueue = document.getElementById('uploadQueue');
    if (uploadQueue) {
        uploadQueue.style.display = 'none';
    }
}

function showUploadSuccess() {
    const uploadSuccess = document.getElementById('uploadSuccess');
    const uploadQueue = document.getElementById('uploadQueue');
    
    if (uploadSuccess) uploadSuccess.style.display = 'block';
    if (uploadQueue) uploadQueue.style.display = 'none';
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}
