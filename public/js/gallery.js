// Gallery Functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;
    
    await initializeGallery();
    await loadImages();
    setupGalleryEvents();
});

let currentPage = 1;
let currentFilter = 'all';
let currentView = 'grid';
let images = [];
let totalImages = 0;

async function initializeGallery() {
    // Update auth UI
    await themeManager.updateAuthUI();
    
    // Setup filter and view from URL params
    const params = utils.parseURLParams();
    if (params.filter) currentFilter = params.filter;
    if (params.view) currentView = params.view;
    if (params.page) currentPage = parseInt(params.page) || 1;
    
    // Update UI state
    updateFilterSelect();
    updateViewToggle();
    
    // Setup modal
    setupImageModal();
}

async function loadImages(append = false) {
    try {
        showLoadingState();
        
        const params = {
            limit: APP_CONFIG.PAGINATION_LIMIT,
            skip: append ? images.length : (currentPage - 1) * APP_CONFIG.PAGINATION_LIMIT
        };
        
        // Add filter if not 'all'
        if (currentFilter !== 'all') {
            params.transformation_type = currentFilter === '' ? null : currentFilter;
        }
        
        const newImages = await apiHelpers.getUserImages(params);
        
        if (append) {
            images.push(...newImages);
        } else {
            images = newImages;
        }
        
        updateImagesDisplay();
        hideLoadingState();
        
    } catch (error) {
        console.error('Failed to load images:', error);
        showError('Failed to load images. Please try again.');
        hideLoadingState();
    }
}

function updateImagesDisplay() {
    const galleryGrid = document.getElementById('galleryGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (images.length === 0) {
        galleryGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    galleryGrid.classList.remove('hidden');
    
    // Update grid class based on view
    galleryGrid.className = `gallery-${currentView}`;
    
    // Generate images HTML
    const imagesHTML = images.map(image => createImageHTML(image)).join('');
    galleryGrid.innerHTML = imagesHTML;
    
    // Setup image events
    setupImageEvents();
    
    // Update pagination
    updatePagination();
}

function createImageHTML(image) {
    const transformationIcon = utils.getTransformationIcon(image.transformation_type);
    const transformationType = utils.formatTransformationType(image.transformation_type);
    
    return `
        <div class="gallery-item" data-image-id="${image.id}">
            <div class="image-container">
                <img src="${image.secure_url}" alt="${utils.escapeHTML(image.title)}" loading="lazy">
                <div class="image-overlay">
                    <div class="image-actions">
                        <button class="action-btn view-btn" data-action="view" title="View Full Size">
                            👁️
                        </button>
                        <button class="action-btn download-btn" data-action="download" title="Download">
                            ⬇️
                        </button>
                        <button class="action-btn delete-btn" data-action="delete" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="image-type-badge">
                    ${transformationIcon} ${transformationType}
                </div>
            </div>
            <div class="image-info">
                <div class="image-title">${utils.escapeHTML(utils.truncate(image.title, 40))}</div>
                <div class="image-meta">
                    <span class="image-date">${utils.formatRelativeTime(image.created_at)}</span>
                    <span class="image-size">ID: ${image.id}</span>
                </div>
            </div>
        </div>
    `;
}

function setupImageEvents() {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        const imageId = parseInt(item.getAttribute('data-image-id'));
        const image = images.find(img => img.id === imageId);
        
        if (!image) return;
        
        // Setup action buttons
        const actionBtns = item.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleImageAction(btn.getAttribute('data-action'), image);
            });
        });
        
        // Setup item click for modal
        item.addEventListener('click', () => {
            showImageModal(image);
        });
    });
}

async function handleImageAction(action, image) {
    switch (action) {
        case 'view':
            showImageModal(image);
            break;
            
        case 'download':
            utils.downloadFile(image.secure_url, image.title);
            toast.success('Download started');
            break;
            
        case 'delete':
            const confirmed = await modal.confirm(
                'Delete Image',
                `Are you sure you want to delete "${image.title}"? This action cannot be undone.`
            );
            
            if (confirmed) {
                await deleteImage(image.id);
            }
            break;
    }
}

async function deleteImage(imageId) {
    try {
        await apiHelpers.deleteImage(imageId);
        
        // Remove from local array
        images = images.filter(img => img.id !== imageId);
        
        // Update display
        updateImagesDisplay();
        
        toast.success('Image deleted successfully');
        
    } catch (error) {
        console.error('Failed to delete image:', error);
        toast.error('Failed to delete image. Please try again.');
    }
}

function setupImageModal() {
    const modal = document.getElementById('imageModal');
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    
    // Close modal events
    [overlay, closeBtn].forEach(el => {
        if (el) {
            el.addEventListener('click', hideImageModal);
        }
    });
    
    // Setup delete button in modal
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const imageId = parseInt(deleteBtn.getAttribute('data-image-id'));
            const image = images.find(img => img.id === imageId);
            
            if (image) {
                hideImageModal();
                await handleImageAction('delete', image);
            }
        });
    }
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            hideImageModal();
        }
    });
}

function showImageModal(image) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const imageTitle = document.getElementById('imageTitle');
    const imageType = document.getElementById('imageType');
    const imageDate = document.getElementById('imageDate');
    const downloadBtn = document.getElementById('downloadBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    
    if (modalImage) modalImage.src = image.secure_url;
    if (modalTitle) modalTitle.textContent = image.title;
    if (imageTitle) imageTitle.textContent = image.title;
    if (imageType) imageType.textContent = utils.formatTransformationType(image.transformation_type);
    if (imageDate) imageDate.textContent = utils.formatDate(image.created_at);
    
    if (downloadBtn) {
        downloadBtn.href = image.secure_url;
        downloadBtn.download = image.title;
    }
    
    if (deleteBtn) {
        deleteBtn.setAttribute('data-image-id', image.id);
    }
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function hideImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function setupGalleryEvents() {
    // Filter change
    const filterSelect = document.getElementById('filterType');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            currentPage = 1;
            updateURLParams();
            loadImages();
        });
    }
    
    // View toggle
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentView = btn.getAttribute('data-view');
            updateViewToggle();
            updateURLParams();
            updateImagesDisplay();
        });
    });
}

function updateFilterSelect() {
    const filterSelect = document.getElementById('filterType');
    if (filterSelect) {
        filterSelect.value = currentFilter;
    }
}

function updateViewToggle() {
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        if (btn.getAttribute('data-view') === currentView) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updatePagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination || images.length < APP_CONFIG.PAGINATION_LIMIT) {
        if (pagination) pagination.innerHTML = '';
        return;
    }
    
    // Simple load more button for now
    pagination.innerHTML = `
        <button class="btn btn-outline" id="loadMoreBtn">Load More Images</button>
    `;
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'Loading...';
            
            currentPage++;
            await loadImages(true);
            
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = 'Load More Images';
        });
    }
}

function updateURLParams() {
    utils.updateURLParams({
        filter: currentFilter === 'all' ? null : currentFilter,
        view: currentView === 'grid' ? null : currentView,
        page: currentPage === 1 ? null : currentPage
    }, true);
}

function showLoadingState() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.remove('hidden');
    }
}

function hideLoadingState() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.add('hidden');
    }
}

function showError(message) {
    toast.error(message);
}

// Handle URL params for direct image access
const params = utils.parseURLParams();
if (params.image) {
    // Show specific image in modal when page loads
    setTimeout(async () => {
        const imageId = parseInt(params.image);
        const image = images.find(img => img.id === imageId);
        if (image) {
            showImageModal(image);
        }
    }, 1000);
}
