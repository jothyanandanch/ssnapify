export type ToastType = 'info' | 'success' | 'error' | 'warning';
let toastId = 0;

export function showToast(message: string, type: ToastType = 'info', duration = 5000): void {
    const container = document.getElementById('toastContainer') || createContainer();
    const toast = document.createElement('div');
    toast.id = `toast-${++toastId}`;
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => removeToast(toast.id), duration);
}

function removeToast(id: string): void {
    document.getElementById(id)?.remove();
}

function createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.id = 'toastContainer';
    document.body.appendChild(div);
    return div;
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function createProgressBar(progress: number): string {
    return `<div class="progress"><div class="bar" style="width:${progress}%"></div></div>`;
}

export function formatDate(iso: string | Date | undefined | null, opts?: Intl.DateTimeFormatOptions): string {
if (!iso) return '';
const d = typeof iso === 'string' ? new Date(iso) : iso;
if (Number.isNaN(d.getTime())) return '';
const options: Intl.DateTimeFormatOptions = opts || {
year: 'numeric',
month: 'short',
day: '2-digit',
hour: '2-digit',
minute: '2-digit',
};
return d.toLocaleString(undefined, options);
}