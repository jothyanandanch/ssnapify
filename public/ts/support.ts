import { api, APIError } from './api.js';
import { showToast } from './utils.js';

interface SupportTicket {
    name: string;
    subject: string;
    message: string;
}

class SupportManager {
    private form!: HTMLFormElement;
    private nameInput!: HTMLInputElement;
    private subjectInput!: HTMLInputElement;
    private messageTextarea!: HTMLTextAreaElement;
    private submitBtn!: HTMLButtonElement;

    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    private initializeElements(): void {
        this.form = document.getElementById('supportForm') as HTMLFormElement;
        this.nameInput = document.getElementById('name') as HTMLInputElement;
        this.subjectInput = document.getElementById('subject') as HTMLInputElement;
        this.messageTextarea = document.getElementById('message') as HTMLTextAreaElement;
        this.submitBtn = document.getElementById('submitTicket') as HTMLButtonElement;
    }

    private setupEventListeners(): void {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();
        if (!this.nameInput.value.trim() || !this.subjectInput.value.trim() || !this.messageTextarea.value.trim()) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        const ticket: SupportTicket = {
            name: this.nameInput.value.trim(),
            subject: this.subjectInput.value.trim(),
            message: this.messageTextarea.value.trim()
        };
        this.setSubmitLoading(true);
        try {
            await api.post('/support/ticket', ticket);
            showToast('Ticket submitted successfully.', 'success');
            this.form.reset();
        } catch (err) {
            const msg = err instanceof APIError ? err.message : 'Failed to submit ticket';
            showToast(msg, 'error');
        } finally {
            this.setSubmitLoading(false);
        }
    }

    private setSubmitLoading(loading: boolean): void {
        this.submitBtn.disabled = loading;
        this.submitBtn.textContent = loading ? 'Submitting...' : 'Submit Ticket';
    }
}

document.addEventListener('DOMContentLoaded', () => new SupportManager());
