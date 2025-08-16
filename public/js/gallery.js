document.addEventListener('DOMContentLoaded', async () => {
    // Require authentication
    if (!auth.requireAuth()) return;

    await initializeGallery();
});

let currentFilter = 'all';
let currentView = 'grid';
let images = [];

async function initializeGallery() {
    setupGalleryControls();
    setupImageModal();
    await loadImages();
}

function setupGalleryControls() {
    // Filter dropdown
    const filterSelect = document.getElementById('filterSelect');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            loadImages();
        });
    }

    // View toggle
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentView = e.target.dataset.view;
            updateViewToggle();
            updateGalleryView();
        });
    });
}

function updateViewToggle() {
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === currentView);
    });
}

function updateGalleryView() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
        galleryGrid.className = `gallery-${currentView}`;
    }
}

async function loadImages() {
    try {
        showLoadingState();

        const params = { limit: 50 };
        
        // Add filter if not 'all'
        if (currentFilter !== 'all') {
            params.transformation_type = currentFilter === '' ? null : currentFilter;
        }

        images = await core.getUserImages(params);
        displayImages();
        hideLoadingState();

    } catch (error) {
        console.error('Failed to load images:', error);
        core.showToast('Failed to load images', 'error');
        hideLoadingState();
    }
}

function displayImages() {
    const galleryGrid = document.getElementById('galleryGrid');
    const emptyState = document.getElementById('emptyState');

    if (images.length === 0) {
        if (galleryGrid) galleryGrid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    if (!galleryGrid) return;

    const imagesHTML = images.map(image => createImageHTML(image)).join('');
    galleryGrid.innerHTML = imagesHTML;

    // Setup image click events
    setupImageEvents();
}

function createImageHTML(image) {
    const transformationType = formatTransformationType(image.transformation_type);
    const formattedDate = formatDate(image.created_at);

    return `
        <div class="gallery-item" data-id="${image.id}">
            <div class="image-container">
                <img src="${image.secure_url}" alt="${image.title}" loading="lazy">
                <div class="image-overlay">
                    <div class="overlay-content">
                        <button class="btn btn-primary btn-sm view-btn" onclick="viewImage(${image.id})">
                            View
                        </button>
                        <button class="btn btn-outline btn-sm download-btn" onclick="downloadImage('${image.secure_url}', '${image.title}')">
                            Download
                        </button>
                    </div>
                </div>
                <div class="image-badge">${transformationType}</div>
            </div>
            <div class="image-info">
                <h4 class="image-title">${truncateText(image.title, 30)}</h4>
                <p class="image-date">${formattedDate}</p>
            </div>
        </div>
    `;
}

function setupImageEvents() {
    // Events are handled by onclick attributes in createImageHTML
}

function setupImageModal() {
    const modal = document.getElementById('imageModal');
    const modalClose = document.getElementById('modalClose');
    const modalOverlay = document.getElementById('modalOverlay');
    const downloadBtn = document.getElementById('downloadBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    // Close modal events
    [modalClose, modalOverlay].forEach(element => {
        if (element) {
            element.addEventListener('click', closeImageModal);
        }
    });

    // Download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const img = document.getElementById('modalImg');
            const title = document.getElementById('modalTitle');
            if (img && title) {
                downloadImage(img.src, title.textContent);
            }
        });
    }

    // Delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const modal = document.getElementById('imageModal');
            const imageId = modal.dataset.imageId;
            if (imageId && confirm('Are you sure you want to delete this image?')) {
                await deleteImage(imageId);
            }
        });
    }
}

function viewImage(imageId) {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const modalTitle = document.getElementById('modalTitle');
    const modalType = document.getElementById('modalType');
    const modalDate = document.getElementById('modalDate');

    if (modal) {
        modal.dataset.imageId = imageId;
        modal.style.display = 'flex';
    }
    
    if (modalImg) modalImg.src = image.secure_url;
    if (modalTitle) modalTitle.textContent = image.title;
    if (modalType) modalType.textContent = formatTransformationType(image.transformation_type);
    if (modalDate) modalDate.textContent = formatDate(image.created_at);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
        modal.dataset.imageId = '';
    }
    
    // Restore body scroll
    document.body.style.overflow = 'auto';
}

function downloadImage(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function deleteImage(imageId) {
    try {
        const response = await core.apiCall(`/images/${imageId}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            core.showToast('Image deleted successfully', 'success');
            closeImageModal();
            // Remove from images array and refresh display
            images = images.filter(img => img.id !== parseInt(imageId));
            displayImages();
        } else {
            throw new Error('Failed to delete image');
        }
    } catch (error) {
        console.error('Delete failed:', error);
        core.showToast('Failed to delete image', 'error');
    }
}

function showLoadingState() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
        galleryGrid.innerHTML = '<div class="loading">Loading your images...</div>';
    }
}

function hideLoadingState() {
    // Loading state is replaced by images or empty state
}

// Utility functions
function formatTransformationType(type) {
    if (!type) return 'Original';
    return type.replace(/_/g, ' ').split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function truncateText(text, length) {
    return text && text.length > length ? text.substring(0, length) + '...' : text;
}
