document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;

    await initializeTool();
    setupToolUpload();
    setupPromptHandling();
});

let toolConfig = window.TOOL_CONFIG || {};
let originalImageUrl = null;
let uploadedImage = null;
let userPrompt = '';

async function initializeTool() {
    if (!toolConfig.type) {
        core.showToast('Tool configuration error', 'error');
        return;
    }

    await checkCredits();
    console.log(`Initialized ${toolConfig.name} tool`);
}

async function checkCredits() {
    try {
        const credits = await core.getCredits();
        if (credits && credits.credit_balance < toolConfig.cost) {
            core.showToast(`Insufficient credits. This tool requires ${toolConfig.cost} credit(s), you have ${credits.credit_balance}.`, 'error');
            
            setTimeout(() => {
                if (confirm('Would you like to upgrade your plan to get more credits?')) {
                    window.location.href = '/pricing.html';
                }
            }, 2000);
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

    // Setup drag and drop
    setupDragAndDrop(uploadZone, fileInput);

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Browse button
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    // Upload zone click
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFile(file) {
    // Validate file
    const validation = core.validateFile(file);
    if (!validation.valid) {
        validation.errors.forEach(error => {
            core.showToast(error, 'error');
        });
        return;
    }

    // Store original image URL for comparison
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImageUrl = e.target.result;
        showPromptSection();
    };
    reader.readAsDataURL(file);

    // Store file for later upload
    window.selectedFile = file;
}

function showPromptSection() {
    const uploadSection = document.getElementById('uploadSection');
    const promptSection = document.getElementById('promptSection');
    const previewImage = document.getElementById('previewImage');
    
    if (uploadSection) uploadSection.style.display = 'none';
    if (promptSection) promptSection.style.display = 'block';
    if (previewImage) previewImage.src = originalImageUrl;
}

function setupPromptHandling() {
    const generateBtn = document.getElementById('generateBtn');
    const promptText = document.getElementById('promptText');
    const exampleBtns = document.querySelectorAll('.example-btn');

    // Generate button
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const prompt = promptText.value.trim();
            if (!prompt) {
                core.showToast('Please enter a description', 'error');
                promptText.focus();
                return;
            }
            
            userPrompt = prompt;
            processFileWithPrompt();
        });
    }

    // Example prompts
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (promptText) {
                promptText.value = prompt;
            }
        });
    });

    // Enter key to generate
    if (promptText) {
        promptText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateBtn.click();
            }
        });
    }
}

async function processFileWithPrompt() {
    if (!window.selectedFile || !userPrompt) {
        core.showToast('Missing file or prompt', 'error');
        return;
    }

    try {
        // Show processing section
        showProcessingSection();

        // Step 1: Upload image
        updateProgress(20, 'Uploading image...');
        console.log('Uploading file:', window.selectedFile.name);
        
        uploadedImage = await uploadImageFixed(window.selectedFile);
        console.log('Upload result:', uploadedImage);
        
        if (!uploadedImage || !uploadedImage.id) {
            throw new Error('Failed to upload image - no image ID returned');
        }

        // Step 2: Apply transformation with prompt
        updateProgress(60, `Applying ${toolConfig.name}...`);
        console.log('Applying transformation with prompt:', userPrompt);
        
        const transformedImage = await applyTransformationWithPrompt(uploadedImage.id, userPrompt);
        console.log('Transformation result:', transformedImage);
        
        if (!transformedImage) {
            throw new Error('Failed to apply transformation - no result returned');
        }

        // Step 3: Show results
        updateProgress(100, 'Complete!');
        setTimeout(() => {
            showResults(transformedImage);
        }, 500);

    } catch (error) {
        console.error('Processing failed:', error);
        showError(error.message || 'Processing failed');
    }
}

// Fixed upload function with proper FormData handling
// Fixed upload function - SIMPLIFIED VERSION
async function uploadImageFixed(file) {
    try {
        console.log('🔄 Starting upload:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
        });

        // Create FormData with exact field names expected by FastAPI
        const formData = new FormData();
        formData.append('file', file);  // This MUST match the FastAPI parameter name
        formData.append('title', file.name || '');

        // Log FormData contents for debugging
        console.log('📦 FormData contents:');
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`  ${key}: FILE - ${value.name} (${value.type}) - ${value.size} bytes`);
            } else {
                console.log(`  ${key}: "${value}"`);
            }
        }

        console.log('📤 Uploading to /images/...');
        
        const response = await core.apiCall('/images/', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${core.getToken()}`
                // IMPORTANT: Don't set Content-Type - let browser set multipart/form-data
            }
        });

        console.log('📥 Response status:', response ? response.status : 'No response');

        if (!response) {
            throw new Error('No response from server');
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Upload error response:', errorText);
            
            let errorMessage = 'Upload failed';
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.detail) {
                    if (Array.isArray(errorData.detail)) {
                        // Handle FastAPI validation errors
                        errorMessage = errorData.detail.map(e => {
                            const location = e.loc ? e.loc.join(' -> ') : 'unknown';
                            return `${location}: ${e.msg}`;
                        }).join('; ');
                    } else {
                        errorMessage = errorData.detail;
                    }
                }
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${errorText}`;
            }
            
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('✅ Upload success:', result);
        return result;

    } catch (error) {
        console.error('💥 Upload function error:', error);
        throw error;
    }
}


async function applyTransformationWithPrompt(imageId, prompt) {
    try {
        if (!imageId) {
            throw new Error('No image ID provided for transformation');
        }

        const endpoint = `/images/${imageId}${toolConfig.endpoint}?prompt=${encodeURIComponent(prompt)}`;
        console.log('Transformation endpoint with prompt:', endpoint);

        const response = await core.apiCall(endpoint, {
            method: 'POST'
        });

        if (!response || !response.ok) {
            const errorText = response ? await response.text() : 'No response';
            throw new Error(`Transformation failed: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Transformation error:', error);
        throw error;
    }
}

function showProcessingSection() {
    const promptSection = document.getElementById('promptSection');
    const processingSection = document.getElementById('processingSection');
    
    if (promptSection) promptSection.style.display = 'none';
    if (processingSection) processingSection.style.display = 'block';
}

function updateProgress(percentage, status) {
    const progressFill = document.getElementById('progressFill');
    const processingStatus = document.getElementById('processingStatus');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (processingStatus) {
        processingStatus.textContent = status;
    }
}

function showResults(transformedImage) {
    const processingSection = document.getElementById('processingSection');
    const resultsSection = document.getElementById('resultsSection');
    const originalImg = document.getElementById('originalImage');
    const processedImg = document.getElementById('processedImage');
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (processingSection) processingSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    
    // Show before/after images
    if (originalImg && originalImageUrl) originalImg.src = originalImageUrl;
    if (processedImg && transformedImage.secure_url) processedImg.src = transformedImage.secure_url;
    
    // Setup download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            downloadImage(transformedImage.secure_url, transformedImage.title);
        });
    }

    // Show success message
    core.showToast('Image processed successfully!', 'success');
}

function showError(message) {
    const processingSection = document.getElementById('processingSection');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    
    if (processingSection) processingSection.style.display = 'none';
    if (errorSection) errorSection.style.display = 'block';
    if (errorMessage) errorMessage.textContent = message;
    
    core.showToast(message, 'error');
}

function downloadImage(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'processed-image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
