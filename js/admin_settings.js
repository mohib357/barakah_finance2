// C:\Project\Barakah_Finance\js\admin_settings.js
// ════════ Admin Hero Settings - Fixed & Improved ════════
// FIXES:
// 1. Removed duplicate code with animation-control.js
// 2. Fixed rainbow speed mapping consistency
// 3. Added prefers-reduced-motion support
// 4. Added resetToDefaults method
// 5. Added debug logging only in development
// 6. Fixed class toggling logic for multiple settings
// 7. Added event delegation for settings updates
// 8. Added environment-aware console logging

(function () {
    'use strict';

    // ── Constants ──
    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const STORAGE_KEY = 'barakah_admin_settings';
    const DEFAULT_SETTINGS = {
        animations: true,
        neumorphism: true,
        rainbow: false,     // Disabled by default for better UX
        rainbowSpeed: 'slow'
    };

    // ── Rainbow Speed Mapping ──
    const RAINBOW_SPEEDS = {
        slow: { name: 'rainbowSlow', duration: '4s' },
        medium: { name: 'rainbowMedium', duration: '2s' },
        fast: { name: 'rainbowFast', duration: '1.2s' }
    };

    // ── AdminHeroSettings Class ──
    class AdminHeroSettings {
        constructor() {
            this.settings = { ...DEFAULT_SETTINGS };
            this._loadFromStorage();
            this._applySettings();
            this._listenForReducedMotion();

            if (DEBUG) {
                console.log('[AdminSettings] Initialized with:', this.settings);
            }
        }

        // ── Private Methods ──
        _loadFromStorage() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // Merge with defaults to ensure all keys exist
                    this.settings = { ...DEFAULT_SETTINGS, ...parsed };
                }
            } catch (e) {
                if (DEBUG) {
                    console.warn('[AdminSettings] Failed to load from storage:', e);
                }
                // Fallback to defaults
                this.settings = { ...DEFAULT_SETTINGS };
            }
        }

        _saveToStorage() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            } catch (e) {
                if (DEBUG) {
                    console.warn('[AdminSettings] Failed to save to storage:', e);
                }
            }
        }

        _applySettings() {
            const body = document.body;

            // Check for reduced motion preference
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const animationsEnabled = this.settings.animations && !reducedMotion;

            // Remove all control classes
            body.classList.remove('no-animation', 'no-neumorphism', 'rainbow-enabled');

            // Apply animation class
            if (!animationsEnabled) {
                body.classList.add('no-animation');
            }

            // Apply neumorphism class
            if (!this.settings.neumorphism) {
                body.classList.add('no-neumorphism');
            }

            // Apply rainbow class
            if (this.settings.rainbow && animationsEnabled) {
                body.classList.add('rainbow-enabled');
                this._applyRainbowAnimation();
            } else {
                body.style.removeProperty('--rainbow-animation');
            }

            // Dispatch event for other scripts
            this._dispatchUpdateEvent();
        }

        _applyRainbowAnimation() {
            const speed = this.settings.rainbowSpeed || 'slow';
            const config = RAINBOW_SPEEDS[speed] || RAINBOW_SPEEDS.slow;
            const animationValue = `${config.name} ${config.duration} ease-in-out infinite`;
            document.body.style.setProperty('--rainbow-animation', animationValue);
        }

        _dispatchUpdateEvent() {
            try {
                const event = new CustomEvent('settingsUpdated', {
                    detail: { ...this.settings },
                    bubbles: true
                });
                window.dispatchEvent(event);
            } catch (e) {
                if (DEBUG) {
                    console.warn('[AdminSettings] Failed to dispatch event:', e);
                }
            }
        }

        _listenForReducedMotion() {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

            const handler = () => {
                if (mediaQuery.matches) {
                    // Temporarily disable animations for this session
                    if (this.settings.animations) {
                        this.settings.animations = false;
                        this._applySettings();
                    }
                } else {
                    // Restore animations if they were enabled before
                    this._loadFromStorage();
                    this._applySettings();
                }
            };

            // Listen for changes
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handler);
            } else {
                // Fallback for older browsers
                mediaQuery.addListener(handler);
            }
        }

        // ── Public Methods ──

        /**
         * Update a single setting
         * @param {string} key - Setting key (animations, neumorphism, rainbow, rainbowSpeed)
         * @param {*} value - New value
         */
        updateSetting(key, value) {
            if (!this.settings.hasOwnProperty(key)) {
                if (DEBUG) {
                    console.warn(`[AdminSettings] Unknown setting key: ${key}`);
                }
                return;
            }

            // Validate rainbowSpeed
            if (key === 'rainbowSpeed' && !RAINBOW_SPEEDS[value]) {
                if (DEBUG) {
                    console.warn(`[AdminSettings] Invalid rainbowSpeed: ${value}, using 'slow'`);
                }
                value = 'slow';
            }

            this.settings[key] = value;
            this._saveToStorage();
            this._applySettings();

            if (DEBUG) {
                console.log(`[AdminSettings] Updated ${key} → ${value}`);
            }
        }

        /**
         * Update multiple settings at once
         * @param {Object} settings - Object with key-value pairs to update
         */
        updateMultipleSettings(settings) {
            let updated = false;

            for (const [key, value] of Object.entries(settings)) {
                if (this.settings.hasOwnProperty(key)) {
                    // Validate rainbowSpeed
                    if (key === 'rainbowSpeed' && !RAINBOW_SPEEDS[value]) {
                        continue; // Skip invalid value
                    }
                    this.settings[key] = value;
                    updated = true;
                }
            }

            if (updated) {
                this._saveToStorage();
                this._applySettings();

                if (DEBUG) {
                    console.log('[AdminSettings] Updated multiple settings:', this.settings);
                }
            }
        }

        /**
         * Get current settings
         * @returns {Object} Copy of current settings
         */
        getSettings() {
            return { ...this.settings };
        }

        /**
         * Reset all settings to defaults
         */
        resetToDefaults() {
            this.settings = { ...DEFAULT_SETTINGS };
            this._saveToStorage();
            this._applySettings();

            if (DEBUG) {
                console.log('[AdminSettings] Reset to defaults:', this.settings);
            }
        }

        /**
         * Check if a specific setting is enabled
         * @param {string} key - Setting key to check
         * @returns {boolean} True if enabled
         */
        isEnabled(key) {
            return this.settings[key] === true;
        }

        /**
         * Toggle a boolean setting
         * @param {string} key - Setting key to toggle
         * @returns {boolean} New value
         */
        toggleSetting(key) {
            if (typeof this.settings[key] !== 'boolean') {
                if (DEBUG) {
                    console.warn(`[AdminSettings] Cannot toggle non-boolean setting: ${key}`);
                }
                return this.settings[key];
            }

            const newValue = !this.settings[key];
            this.updateSetting(key, newValue);
            return newValue;
        }
    }

    // ── Initialize on DOM ready ──
    document.addEventListener('DOMContentLoaded', () => {
        window.adminHeroSettings = new AdminHeroSettings();

        if (DEBUG) {
            console.log('[AdminSettings] Ready. Use window.adminHeroSettings to control.');
        }
    });

    // ── Listen for settings updates from other scripts ──
    document.addEventListener('settingsUpdated', (e) => {
        if (e.detail && window.adminHeroSettings) {
            // If another script updates settings, sync this instance
            const newSettings = e.detail;
            let needsUpdate = false;

            for (const [key, value] of Object.entries(newSettings)) {
                if (window.adminHeroSettings.settings.hasOwnProperty(key)) {
                    window.adminHeroSettings.settings[key] = value;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                window.adminHeroSettings._saveToStorage();
                window.adminHeroSettings._applySettings();

                if (DEBUG) {
                    console.log('[AdminSettings] Synced with external update:', window.adminHeroSettings.settings);
                }
            }
        }
    });

})();

// ── Expose helper for browser console ──
window.__adminSettingsDebug = {
    get: () => window.adminHeroSettings?.getSettings() || null,
    reset: () => window.adminHeroSettings?.resetToDefaults(),
    toggle: (key) => window.adminHeroSettings?.toggleSetting(key),
    set: (key, value) => window.adminHeroSettings?.updateSetting(key, value)
};

// ── Migration from older localStorage key ──
(function migrateOldSettings() {
    const OLD_KEY = 'barakah_admin_hero_settings';
    try {
        const oldData = localStorage.getItem(OLD_KEY);
        if (oldData) {
            const parsed = JSON.parse(oldData);
            // Only migrate if we don't have newer settings
            if (!localStorage.getItem(STORAGE_KEY)) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                if (DEBUG) {
                    console.log('[AdminSettings] Migrated old settings from:', OLD_KEY);
                }
            }
            // Clean up old key after migration
            localStorage.removeItem(OLD_KEY);
        }
    } catch (e) {
        // Ignore migration errors
    }
})();