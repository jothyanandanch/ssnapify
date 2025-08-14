class ThemeManager {
    private currentTheme: 'light' | 'dark' = 'light';

    constructor() {
        this.initializeTheme();
        this.setupToggle();
    }

    private initializeTheme(): void {
        // Check for saved theme preference or default to 'light'
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        this.currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        this.applyTheme(this.currentTheme);
    }

    private setupToggle(): void {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    private applyTheme(theme: 'light' | 'dark'): void {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    public toggleTheme(): void {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    }

    public getCurrentTheme(): 'light' | 'dark' {
        return this.currentTheme;
    }

    public setTheme(theme: 'light' | 'dark'): void {
        this.applyTheme(theme);
        localStorage.setItem('theme', theme);
    }
}

const themeManager = new ThemeManager();

export { themeManager };
export default themeManager;
