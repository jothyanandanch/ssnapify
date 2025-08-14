import { CONFIG } from './config.js';

class APIError extends Error {
    constructor(public status: number, message: string, public data?: any) {
        super(message);
        this.name = 'APIError';
    }
}

class APIClient {
    private baseURL: string = CONFIG.API_BASE;

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };
        
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new APIError(response.status, errorData.detail || response.statusText, errorData);
        }
        return response.json();
    }

    async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
        const url = new URL(`${this.baseURL}${endpoint}`);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: this.getHeaders()
        });

        return this.handleResponse<T>(response);
    }

    async post<T>(endpoint: string, data?: any, isFormData = false): Promise<T> {
        const headers = this.getHeaders();
        if (isFormData) {
            delete (headers as any)['Content-Type'];
        }

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers,
            body: isFormData ? data : JSON.stringify(data)
        });

        return this.handleResponse<T>(response);
    }

    async delete<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });

        return this.handleResponse<T>(response);
    }

    async uploadWithProgress(
        endpoint: string, 
        formData: FormData, 
        onProgress?: (progress: number) => void
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const progress = (e.loaded / e.total) * 100;
                    onProgress(progress);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject(new APIError(xhr.status, xhr.statusText));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new APIError(0, 'Network error'));
            });

            const token = localStorage.getItem('token');
            xhr.open('POST', `${this.baseURL}${endpoint}`);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.send(formData);
        });
    }
}

export const api = new APIClient();
export { APIError };
