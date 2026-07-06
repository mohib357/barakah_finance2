// C:\Project\barakah_finance2\js\animation_control.js

(function () {
    'use strict';

    // ── Constants ──
    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const STORAGE_KEY = 'barakah_animation_settings';

    // ── Rainbow Speed Mapping (matches admin_settings.js) ──
    const RAINBOW_SPEEDS = {
        slow: { name: 'rainbowSlow', duration: '4s' },
        medium: { name: 'rainbowMedium', duration: '2s' },
        fast: { name: 'rainbowFast', duration: '1.2s' }
    };

    // ── Default Settings ──
    const DEFAULT_SETTINGS = {
        animations: true,
        neumorphism: true,
        rainbow: false,     // Disabled by default
        rainbowSpeed: 'slow'
    };

    // ── AnimationControl Class ──
    class AnimationControl {
        constructor() {
            this.settings = { ...DEFAULT_SETTINGS };
            this._initialized = false;
            this._init();
        }

        // ── Private Methods ──

        _init() {
            // Try to use adminHeroSettings if available (single source of truth)
            if (typeof window.adminHeroSettings !== 'undefined' && window.adminHeroSettings) {
                this.settings = { ...window.adminHeroSettings.getSettings() };
                if (DEBUG) {
                    console.log('[AnimationControl] Using settings from adminHeroSettings');
                }
            } else {
                // Fallback: load from localStorage
                this._loadFromStorage();
                if (DEBUG) {
                    console.log('[AnimationControl] Using settings from localStorage (fallback)');
                }
            }

            // Apply settings
            this._applySettings();

            // Listen for reduced motion preference
            this._listenForReducedMotion();

            // Listen for settings updates from adminHeroSettings
            this._listenForAdminChanges();

            this._initialized = true;

            if (DEBUG) {
                console.log('[AnimationControl] Initialized with:', this.settings);
            }
        }

        _loadFromStorage() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.settings = { ...DEFAULT_SETTINGS, ...parsed };
                }
            } catch (e) {
                if (DEBUG) {
                    console.warn('[AnimationControl] Failed to load from storage:', e);
                }
                this.settings = { ...DEFAULT_SETTINGS };
            }
        }

        _saveToStorage() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
            } catch (e) {
                if (DEBUG) {
                    console.warn('[AnimationControl] Failed to save to storage:', e);
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
                const event = new CustomEvent('animationSettingsUpdated', {
                    detail: { ...this.settings },
                    bubbles: true
                });
                window.dispatchEvent(event);
            } catch (e) {
                if (DEBUG) {
                    console.warn('[AnimationControl] Failed to dispatch event:', e);
                }
            }
        }

        _listenForReducedMotion() {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

            const handler = () => {
                if (mediaQuery.matches) {
                    // Temporarily disable animations for this session
                    if (this.settings.animations) {
                        // Store the fact that animations were disabled by user preference
                        this.settings._animationsDisabledByPref = true;
                        this.settings.animations = false;
                        this._applySettings();
                    }
                } else {
                    // Restore animations if they were enabled before
                    if (this.settings._animationsDisabledByPref) {
                        // Try to get the original value
                        this._loadFromStorage();
                        this._applySettings();
                    }
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

        _listenForAdminChanges() {
            // Listen for settingsUpdated events from adminHeroSettings
            window.addEventListener('settingsUpdated', (e) => {
                if (e.detail) {
                    const newSettings = e.detail;
                    let needsUpdate = false;

                    for (const [key, value] of Object.entries(newSettings)) {
                        if (this.settings.hasOwnProperty(key)) {
                            if (this.settings[key] !== value) {
                                this.settings[key] = value;
                                needsUpdate = true;
                            }
                        }
                    }

                    if (needsUpdate) {
                        this._applySettings();
                        if (DEBUG) {
                            console.log('[AnimationControl] Synced with admin settings:', this.settings);
                        }
                    }
                }
            });
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
                    console.warn(`[AnimationControl] Unknown setting key: ${key}`);
                }
                return;
            }

            // Validate rainbowSpeed
            if (key === 'rainbowSpeed' && !RAINBOW_SPEEDS[value]) {
                if (DEBUG) {
                    console.warn(`[AnimationControl] Invalid rainbowSpeed: ${value}, using 'slow'`);
                }
                value = 'slow';
            }

            this.settings[key] = value;
            this._saveToStorage();
            this._applySettings();

            // Also update adminHeroSettings if available
            if (window.adminHeroSettings) {
                window.adminHeroSettings.updateSetting(key, value);
            }

            if (DEBUG) {
                console.log(`[AnimationControl] Updated ${key} → ${value}`);
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

                // Also update adminHeroSettings if available
                if (window.adminHeroSettings) {
                    window.adminHeroSettings.updateMultipleSettings(settings);
                }

                if (DEBUG) {
                    console.log('[AnimationControl] Updated multiple settings:', this.settings);
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

            // Also reset adminHeroSettings if available
            if (window.adminHeroSettings) {
                window.adminHeroSettings.resetToDefaults();
            }

            if (DEBUG) {
                console.log('[AnimationControl] Reset to defaults');
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
                    console.warn(`[AnimationControl] Cannot toggle non-boolean setting: ${key}`);
                }
                return this.settings[key];
            }

            const newValue = !this.settings[key];
            this.updateSetting(key, newValue);
            return newValue;
        }

        /**
         * Force apply settings (useful after DOM changes)
         */
        refresh() {
            this._applySettings();
            if (DEBUG) {
                console.log('[AnimationControl] Refreshed settings');
            }
        }
    }

    // ── Initialize on DOM ready ──
    document.addEventListener('DOMContentLoaded', () => {
        // Only initialize if not already created by admin_settings.js
        if (typeof window.animationControl === 'undefined') {
            window.animationControl = new AnimationControl();

            if (DEBUG) {
                console.log('[AnimationControl] Ready. Use window.animationControl to control.');
            }
        } else {
            if (DEBUG) {
                console.log('[AnimationControl] Already initialized, skipping.');
            }
        }
    });

    // ── Listen for animation settings updates from other scripts ──
    document.addEventListener('animationSettingsUpdated', (e) => {
        if (e.detail && window.animationControl) {
            // If another script updates settings, sync this instance
            const newSettings = e.detail;
            let needsUpdate = false;

            for (const [key, value] of Object.entries(newSettings)) {
                if (window.animationControl.settings.hasOwnProperty(key)) {
                    if (window.animationControl.settings[key] !== value) {
                        window.animationControl.settings[key] = value;
                        needsUpdate = true;
                    }
                }
            }

            if (needsUpdate) {
                window.animationControl._saveToStorage();
                window.animationControl._applySettings();

                if (DEBUG) {
                    console.log('[AnimationControl] Synced with external update:', window.animationControl.settings);
                }
            }
        }
    });

    // ── Expose helper for browser console ──
    window.__animationDebug = {
        get: () => window.animationControl?.getSettings() || null,
        reset: () => window.animationControl?.resetToDefaults(),
        toggle: (key) => window.animationControl?.toggleSetting(key),
        set: (key, value) => window.animationControl?.updateSetting(key, value),
        refresh: () => window.animationControl?.refresh()
    };

})();

// ════════ Legacy API (for backward compatibility) ════════
// If the old API was used, map it to the new one
if (typeof window.forceAnimationSettings === 'undefined') {
    window.forceAnimationSettings = function (settings) {
        if (window.animationControl) {
            window.animationControl.updateMultipleSettings(settings);
        } else {
            // Fallback: wait for initialization
            document.addEventListener('DOMContentLoaded', function () {
                if (window.animationControl) {
                    window.animationControl.updateMultipleSettings(settings);
                }
            });
        }
    };
}