// C:\Project\barakah_finance2\js\language.js

(function () {
    'use strict';

    const DEFAULT_LANG = 'en';
    const STORAGE_KEY = 'bf_language';

    // Current language
    let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

    // Get translation for a key
    function t(key) {
        if (!window.translations || !window.translations[currentLang]) {
            console.warn('[Language] Translations not loaded');
            return key;
        }

        const translation = window.translations[currentLang][key];
        return translation !== undefined ? translation : key;
    }

    // Update all translatable elements
    function updatePageLanguage() {
        // Update all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');

        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = t(key);

            // Check if it's an input placeholder
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.hasAttribute('placeholder')) {
                    el.placeholder = translation;
                }
            } else {
                // For other elements, update text content or innerHTML
                if (el.hasAttribute('data-i18n-html')) {
                    el.innerHTML = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Update HTML lang attribute
        document.documentElement.lang = currentLang;

        // Update direction for Arabic
        if (currentLang === 'ar') {
            document.documentElement.dir = 'rtl';
        } else {
            document.documentElement.dir = 'ltr';
        }

        // Update language selector UI
        updateLanguageSelectorUI();
    }

    // Update language selector button text
    function updateLanguageSelectorUI() {
        const langBtn = document.getElementById('currentLangBtn');
        const langFlags = {
            en: '🇬🇧 EN',
            bn: '🇧🇩 বাং',
            ar: '🇸🇦 ع'
        };

        if (langBtn) {
            langBtn.textContent = langFlags[currentLang] || '🌐';
        }

        // Update active state in dropdown
        const langOptions = document.querySelectorAll('.lang-option');
        langOptions.forEach(option => {
            const lang = option.getAttribute('data-lang');
            if (lang === currentLang) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    // Switch language
    function switchLanguage(lang) {
        if (!window.translations || !window.translations[lang]) {
            console.error('[Language] Invalid language:', lang);
            return;
        }

        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        updatePageLanguage();

        // Dispatch custom event for other scripts to listen
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: lang }
        }));
    }

    // Initialize language system
    function initLanguage() {
        // Set initial language
        updatePageLanguage();

        // Add click handlers to language options
        document.addEventListener('click', function (e) {
            const langOption = e.target.closest('.lang-option');
            if (langOption) {
                const lang = langOption.getAttribute('data-lang');
                if (lang) {
                    switchLanguage(lang);
                    // Close dropdown
                    const dropdown = document.getElementById('langDropdown');
                    if (dropdown) {
                        dropdown.classList.remove('active');
                    }
                }
            }

            // Toggle language dropdown
            if (e.target.closest('#currentLangBtn')) {
                e.preventDefault();
                const dropdown = document.getElementById('langDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('active');
                }
            }

            // Close dropdown when clicking outside
            if (!e.target.closest('.lang-selector')) {
                const dropdown = document.getElementById('langDropdown');
                if (dropdown && dropdown.classList.contains('active')) {
                    dropdown.classList.remove('active');
                }
            }
        });
    }

    // Export functions globally
    window.LanguageManager = {
        t: t,
        switchLanguage: switchLanguage,
        getCurrentLang: () => currentLang,
        init: initLanguage
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLanguage);
    } else {
        initLanguage();
    }

})();
