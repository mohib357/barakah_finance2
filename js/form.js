// C:\Project\barakah_finance2\js\form.js

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── Check dependencies ──
    function isDBAvailable() {
        return typeof DB !== 'undefined' && DB !== null;
    }

    function isBDDataAvailable() {
        return typeof BD_DATA !== 'undefined' && BD_DATA !== null;
    }

    function isTranslationsAvailable() {
        return typeof TRANSLATIONS !== 'undefined' && TRANSLATIONS !== null;
    }

    // ── State ──
    let currentLang = 'bn';
    let currentCropTarget = null; // 'photo' | 'sig'
    let cropperInstance = null;
    let cropW = 300,
        cropH = 280,
        cropMaxKB = 300;
    let submittedFormData = null;
    let applicantNIDFiles = [];
    let nomineeNIDFiles = [];

    // ── Toast function ──
    function showToast(msg, color = '#065F46') {
        const existing = document.querySelector('.toast-msg');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: ${color};
            color: #fff;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 0.9rem;
            z-index: 99999;
            font-family: 'Noto Serif Bengali', serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            animation: slideUp 0.3s ease;
            max-width: 320px;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.4s';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // ── Ensure slideUp animation exists ──
    (function ensureAnimation() {
        if (!document.querySelector('style[data-form-toast]')) {
            const style = document.createElement('style');
            style.dataset.formToast = '1';
            style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    })();

    // ════════ THEME ════════

    function initTheme() {
        const saved = localStorage.getItem('bf_theme') || 'light';
        if (saved === 'dark') {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
            const toggle = document.getElementById('themeToggle');
            if (toggle) toggle.classList.add('active');
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        document.documentElement.classList.toggle('dark-mode', isDark);
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.classList.toggle('active', isDark);
        localStorage.setItem('bf_theme', isDark ? 'dark' : 'light');
    }

    // ════════ LANGUAGE ════════

    function changeLanguage(lang) {
        if (!isTranslationsAvailable()) {
            if (DEBUG) console.warn('[Form] TRANSLATIONS not available');
            return;
        }

        currentLang = lang;
        const t = TRANSLATIONS[lang];
        if (!t) return;

        // Update all translatable elements
        const elements = {
            'hdr-title': t.hdrTitle,
            'hdr-slogan': t.hdrSlogan,
            'hdr-address': t.hdrAddress,
            'form-title': t.formTitle,
            'form-subtitle': t.formSubtitle,
            'sec1-title': t.sec1Title,
            'sec2-title': t.sec2Title,
            'sec3-title': t.sec3Title,
            'sec4-title': t.sec4Title,
            'lbl-submit': t.lblSubmit,
            'lbl-submit-note': t.lblSubmitNote,
            'success-title': t.successTitle,
            'success-msg': t.successMsg,
            'admin-link': t.adminLink
        };

        for (const [id, text] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        }

        // RTL support
        document.body.classList.toggle('lang-ar', lang === 'ar');
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    }

    // ════════ DATE ════════

    function setDate() {
        const now = new Date();
        const dateEl = document.getElementById('submitDate');
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('bn-BD', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    // ════════ STEP PROGRESS ════════

    function updateProgress() {
        const fields = [
            document.getElementById('applicantNameBn')?.value,
            document.getElementById('applicantNameEn')?.value,
            document.getElementById('nidNumber')?.value,
            document.getElementById('dob')?.value,
            document.getElementById('addrVillage')?.value,
            document.getElementById('nomineeName_bn')?.value,
            document.getElementById('termsAgree')?.checked ? '1' : ''
        ];

        const filled = fields.filter(v => v && v.length > 0).length;
        const step = Math.min(3, Math.floor((filled / 7) * 4));
        updateStepBar(step);
    }

    function updateStepBar(active) {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById('sd' + (i + 1));
            if (!dot) continue;
            dot.className = 'step-dot';
            if (i < active) dot.classList.add('done');
            else if (i === active) dot.classList.add('active');
        }
    }

    // ════════ OCCUPATION HANDLER ════════

    function handleOccChange(select, customInputId) {
        const custom = document.getElementById(customInputId);
        if (!custom) return;

        const isOther = select.value === 'অন্যান্য' || select.value === 'অন্যান্য';
        custom.classList.toggle('hidden', !isOther);
        custom.required = isOther;
        if (!isOther) custom.value = '';
    }

    // ════════ ADDRESS CASCADE ════════

    function populateDivisions() {
        if (!isBDDataAvailable()) {
            if (DEBUG) console.warn('[Form] BD_DATA not available');
            return;
        }

        const select = document.getElementById('addrDivision');
        if (!select) return;

        select.innerHTML = '<option value="">-- বিভাগ --</option>';
        Object.keys(BD_DATA).forEach(div => {
            const option = document.createElement('option');
            option.value = div;
            option.textContent = div;
            select.appendChild(option);
        });

        // Default: Rangpur
        select.value = 'রংপুর';
        populateDistricts();
    }

    function populateDistricts() {
        if (!isBDDataAvailable()) return;

        const div = document.getElementById('addrDivision')?.value;
        const select = document.getElementById('addrDistrict');
        if (!select) return;

        select.innerHTML = '<option value="">-- জেলা --</option>';
        document.getElementById('addrThana').innerHTML = '<option value="">-- থানা/উপজেলা --</option>';
        document.getElementById('addrPost').innerHTML = '<option value="">-- পোস্ট অফিস --</option>';
        document.getElementById('addrPostCode').value = '';

        if (!div || !BD_DATA[div]) return;

        Object.keys(BD_DATA[div]).forEach(dist => {
            const option = document.createElement('option');
            option.value = dist;
            option.textContent = dist;
            select.appendChild(option);
        });

        if (div === 'রংপুর') {
            select.value = 'লালমনিরহাট';
            populateThanas();
        }
    }

    function populateThanas() {
        if (!isBDDataAvailable()) return;

        const div = document.getElementById('addrDivision')?.value;
        const dist = document.getElementById('addrDistrict')?.value;
        const select = document.getElementById('addrThana');
        if (!select) return;

        select.innerHTML = '<option value="">-- থানা/উপজেলা --</option>';
        document.getElementById('addrPost').innerHTML = '<option value="">-- পোস্ট অফিস --</option>';
        document.getElementById('addrPostCode').value = '';

        if (!div || !dist || !BD_DATA[div] || !BD_DATA[div][dist]) return;

        Object.keys(BD_DATA[div][dist]).forEach(thana => {
            const option = document.createElement('option');
            option.value = thana;
            option.textContent = thana;
            select.appendChild(option);
        });

        if (dist === 'লালমনিরহাট') {
            select.value = 'আদিতমারী';
            populatePostOffices();
        }
    }

    function populatePostOffices() {
        if (!isBDDataAvailable()) return;

        const div = document.getElementById('addrDivision')?.value;
        const dist = document.getElementById('addrDistrict')?.value;
        const thana = document.getElementById('addrThana')?.value;
        const select = document.getElementById('addrPost');
        if (!select) return;

        select.innerHTML = '<option value="">-- পোস্ট অফিস --</option>';
        document.getElementById('addrPostCode').value = '';

        const offices = BD_DATA[div]?.[dist]?.[thana];
        if (!offices) return;

        offices.forEach(office => {
            const option = document.createElement('option');
            option.value = office.code;
            option.textContent = office.name;
            option.dataset.code = office.code;
            select.appendChild(option);
        });
    }

    function fillPostCode() {
        const select = document.getElementById('addrPost');
        const selected = select?.options[select.selectedIndex];
        const codeInput = document.getElementById('addrPostCode');
        if (codeInput) {
            codeInput.value = selected?.dataset?.code || selected?.value || '';
        }
    }

    function copyCurrAddr() {
        const same = document.getElementById('sameAddrCheck')?.checked;
        const permanent = document.getElementById('permanentAddress');
        if (!permanent) return;

        if (same) {
            const div = document.getElementById('addrDivision')?.value || '';
            const dist = document.getElementById('addrDistrict')?.value || '';
            const thana = document.getElementById('addrThana')?.value || '';
            const postSelect = document.getElementById('addrPost');
            const post = postSelect?.options[postSelect.selectedIndex]?.textContent || '';
            const code = document.getElementById('addrPostCode')?.value || '';
            const village = document.getElementById('addrVillage')?.value || '';
            permanent.value = `${village}, ${post} - ${code}, ${thana}, ${dist}, ${div}`;
        } else {
            permanent.value = '';
        }
    }

    // ════════ PHONE HANDLING ════════

    let phoneCount = 1;

    function addPhoneField() {
        if (phoneCount >= 3) {
            showToast('সর্বোচ্চ ৩টি নম্বর দেওয়া যাবে', '#C9A227');
            return;
        }

        phoneCount++;
        const container = document.getElementById('phoneContainer');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'phone-row mb-2';
        row.id = 'phone-row-' + (phoneCount - 1);
        row.innerHTML = `
            <select class="country-code-sel">
                <option value="+880" data-digits="11">🇧🇩 +880</option>
                <option value="+91" data-digits="10">🇮🇳 +91</option>
                <option value="+1" data-digits="10">🇺🇸 +1</option>
                <option value="+44" data-digits="10">🇬🇧 +44</option>
                <option value="+966" data-digits="9">🇸🇦 +966</option>
                <option value="+971" data-digits="9">🇦🇪 +971</option>
            </select>
            <input type="tel" class="form-input flex-1" placeholder="মোবাইল নম্বর (ইংরেজিতে)"
                inputmode="numeric" oninput="validatePhone(this)" />
            <button type="button" onclick="this.parentElement.remove(); phoneCount--;"
                class="text-red-500 text-xl font-bold px-2" title="সরান">✕</button>
        `;
        container.appendChild(row);
    }

    function validatePhone(input) {
        // Only allow digits
        input.value = input.value.replace(/[^\d]/g, '');

        const row = input.closest('.phone-row');
        const select = row?.querySelector('.country-code-sel');
        if (select) {
            const selected = select.selectedOptions[0];
            const digits = parseInt(selected?.dataset?.digits || '11');
            if (input.value.length > digits) {
                input.value = input.value.slice(0, digits);
            }
        }
    }

    // ════════ DRAG & DROP HELPERS ════════

    function handleDrag(event, zoneId) {
        event.preventDefault();
        const zone = document.getElementById(zoneId);
        if (zone) zone.classList.add('dragover');
    }

    function handleDragLeave(event, zoneId) {
        const zone = document.getElementById(zoneId);
        if (zone) zone.classList.remove('dragover');
    }

    function handleDrop(event, inputId, zoneId) {
        event.preventDefault();
        const zone = document.getElementById(zoneId);
        if (zone) zone.classList.remove('dragover');

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            const input = document.getElementById(inputId);
            if (input) {
                const dataTransfer = new DataTransfer();
                for (const file of files) {
                    dataTransfer.items.add(file);
                }
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        }
    }

    // ════════ NID UPLOAD ════════

    function handleNIDUpload(input, who) {
        const files = Array.from(input.files);
        const previewBox = document.getElementById(
            who === 'applicant' ? 'nidPreviewBox' : 'nomNIDPreviewBox'
        );
        if (!previewBox) return;

        previewBox.innerHTML = '';
        const storage = who === 'applicant' ? applicantNIDFiles : nomineeNIDFiles;
        storage.length = 0;

        for (const file of files) {
            if (file.size > 2 * 1024 * 1024) {
                showToast('ফাইলটি ২ MB এর বেশি।', '#e53e3e');
                continue;
            }

            storage.push(file);

            const reader = new FileReader();
            reader.onload = function (e) {
                const isImage = file.type.startsWith('image/');
                const thumb = document.createElement(isImage ? 'img' : 'div');

                if (isImage) {
                    thumb.src = e.target.result;
                    thumb.className = 'nid-preview-thumb';
                    thumb.alt = 'NID';
                } else {
                    thumb.className =
                        'nid-preview-thumb flex items-center justify-center bg-red-50 border border-gold-500 rounded text-xs text-red-600 text-center p-1';
                    thumb.textContent = '📄 PDF';
                }
                previewBox.appendChild(thumb);
            };
            reader.readAsDataURL(file);
        }
    }

    // ════════ IMAGE CROPPER ════════

    function openCropper(input, target, w, h, maxKB) {
        const file = input.files?.[0];
        if (!file) return;

        // Check if Cropper is available
        if (typeof Cropper === 'undefined') {
            showToast('ক্রপার লাইব্রেরি লোড হয়নি।', '#e53e3e');
            return;
        }

        currentCropTarget = target;
        cropW = w;
        cropH = h;
        cropMaxKB = maxKB;

        const faceGuide = document.getElementById('faceGuide');
        if (faceGuide) faceGuide.classList.toggle('hidden', target !== 'photo');

        const titleEl = document.getElementById('cropperTitle');
        if (titleEl) {
            titleEl.textContent = target === 'photo' ? 'পাসপোর্ট ছবি ক্রপ করুন' : 'স্বাক্ষর ক্রপ করুন';
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('cropperImg');
            if (!img) return;

            img.src = e.target.result;
            const modal = document.getElementById('cropperModal');
            if (modal) modal.classList.remove('hidden');

            // Destroy existing cropper
            if (cropperInstance) {
                cropperInstance.destroy();
                cropperInstance = null;
            }

            // Initialize cropper after image loads
            setTimeout(() => {
                cropperInstance = new Cropper(img, {
                    aspectRatio: w / h,
                    viewMode: 1,
                    autoCropArea: 0.85,
                    movable: true,
                    zoomable: true,
                    rotatable: false,
                    scalable: false,
                    guides: true,
                    highlight: false
                });
            }, 100);
        };
        reader.readAsDataURL(file);
    }

    function closeCropper() {
        const modal = document.getElementById('cropperModal');
        if (modal) modal.classList.add('hidden');

        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
    }

    function cropAndSave() {
        if (!cropperInstance) return;

        const canvas = cropperInstance.getCroppedCanvas({
            width: cropW,
            height: cropH
        });

        compressCanvas(canvas, cropMaxKB, function (dataURL, wasCompressed) {
            if (wasCompressed) {
                showToast('ছবিটি অপটিমাইজ করা হয়েছে।', '#C9A227');
            }

            if (currentCropTarget === 'photo') {
                const preview = document.getElementById('photoPreview');
                if (preview) {
                    preview.src = dataURL;
                    preview.classList.remove('hidden');
                }
                const placeholder = document.getElementById('photoPlaceholder');
                if (placeholder) placeholder.classList.add('hidden');
            } else if (currentCropTarget === 'sig') {
                const preview = document.getElementById('sigPreview');
                if (preview) {
                    preview.src = dataURL;
                    preview.classList.remove('hidden');
                }
                const placeholder = document.getElementById('sigPlaceholder');
                if (placeholder) placeholder.classList.add('hidden');
            }

            closeCropper();
        });
    }

    // ════════ IMAGE COMPRESSION ════════

    function compressCanvas(canvas, maxKB, callback) {
        const maxBytes = maxKB * 1024;
        let quality = 0.92;

        function tryCompress() {
            const dataURL = canvas.toDataURL('image/jpeg', quality);
            // Approximate size: base64 length * 0.75
            const bytes = Math.ceil((dataURL.length - 22) * 0.75);

            if (bytes <= maxBytes || quality <= 0.3) {
                callback(dataURL, quality < 0.88);
            } else {
                quality -= 0.08;
                tryCompress();
            }
        }

        tryCompress();
    }

    // ════════ FORM SUBMISSION ════════

    function submitFormData() {
        // Check required fields
        const required = [
            { id: 'applicantNameBn', label: 'আবেদনকারীর নাম (বাংলা)' },
            { id: 'applicantNameEn', label: 'Applicant Name (English)' },
            { id: 'fatherNameBn', label: 'পিতার নাম (বাংলা)' },
            { id: 'nidNumber', label: 'এনআইডি নম্বর' },
            { id: 'dob', label: 'জন্ম তারিখ' },
            { id: 'occupationSel', label: 'পেশা' },
            { id: 'incomeSel', label: 'আয়ের উৎস' },
            { id: 'addrVillage', label: 'বর্তমান ঠিকানা' },
            { id: 'permanentAddress', label: 'স্থায়ী ঠিকানা' },
            { id: 'nomineeName_bn', label: 'নমিনির নাম' },
            { id: 'nomineeRelation', label: 'নমিনির সম্পর্ক' }
        ];

        for (const r of required) {
            const el = document.getElementById(r.id);
            if (!el || !el.value.trim()) {
                showToast(`"${r.label}" পূরণ করুন`, '#e53e3e');
                el?.focus();
                return;
            }
        }

        // Check terms
        if (!document.getElementById('termsAgree')?.checked) {
            showToast('শর্তাবলীতে সম্মতি দিন', '#e53e3e');
            return;
        }

        // Check signature
        const sigPreview = document.getElementById('sigPreview');
        if (!sigPreview || sigPreview.classList.contains('hidden') || !sigPreview.src) {
            showToast('স্বাক্ষর আপলোড করুন', '#e53e3e');
            return;
        }

        // Check photo
        const photoPreview = document.getElementById('photoPreview');
        if (!photoPreview || photoPreview.classList.contains('hidden') || !photoPreview.src) {
            showToast('পাসপোর্ট ছবি আপলোড করুন', '#e53e3e');
            return;
        }

        // Validate NID
        const nidVal = document.getElementById('nidNumber').value.replace(/[^\d]/g, '');
        if (nidVal.length < 10) {
            showToast('এনআইডি নম্বর সঠিক নয় (১০-১৭ ডিজিট)', '#e53e3e');
            return;
        }

        // Collect occupation
        const occSelect = document.getElementById('occupationSel');
        const occCustom = document.getElementById('occupationCustom');
        const occupation = occSelect.value === 'অন্যান্য' ?
            occCustom.value :
            occSelect.value;

        // Collect income source
        const incSelect = document.getElementById('incomeSel');
        const incCustom = document.getElementById('incomeCustom');
        const incomeSource = incSelect.value === 'অন্যান্য' ?
            incCustom.value :
            incSelect.value;

        // Collect phones
        const phones = [];
        document.querySelectorAll('#phoneContainer .phone-row').forEach(row => {
            const code = row.querySelector('.country-code-sel')?.value || '';
            const num = row.querySelector('input[type="tel"]')?.value || '';
            if (num) phones.push(code + num);
        });

        // Build address
        const address = buildAddress();

        // Build form data
        submittedFormData = {
            id: generateID(),
            submittedAt: new Date().toISOString(),
            status: 'pending',
            approvals: {
                committee: [],
                secretary: false,
                vicePresident: false,
                president: false
            },
            memberID: '',
            // Applicant
            applicantNameBn: document.getElementById('applicantNameBn').value,
            applicantNameEn: document.getElementById('applicantNameEn').value,
            fatherNameBn: document.getElementById('fatherNameBn').value,
            fatherNameEn: document.getElementById('fatherNameEn').value,
            motherNameBn: document.getElementById('motherNameBn').value,
            motherNameEn: document.getElementById('motherNameEn').value,
            nidNumber: nidVal,
            dob: document.getElementById('dob').value,
            gender: document.getElementById('gender').value,
            occupation: occupation,
            incomeSource: incomeSource,
            currentAddress: address,
            permanentAddress: document.getElementById('permanentAddress').value,
            phones: phones,
            photoData: photoPreview.src,
            sigData: sigPreview.src,
            // Nominee
            nomineeName_bn: document.getElementById('nomineeName_bn').value,
            nomineeName_en: document.getElementById('nomineeName_en').value,
            nomineeFatherBn: document.getElementById('nomineeFatherBn').value,
            nomineeFatherEn: document.getElementById('nomineeFatherEn').value,
            nomineeRelation: document.getElementById('nomineeRelation').value,
            nomineeNID: document.getElementById('nomineeNID').value,
            nomineePhone: (document.getElementById('nomCountryCode')?.value || '') +
                (document.getElementById('nomineePhone')?.value || ''),
            nomineeAddress: document.getElementById('nomineeAddress').value
        };

        // Save to DB or localStorage
        if (isDBAvailable()) {
            const apps = DB.getApplications() || [];
            apps.push(submittedFormData);
            DB.set(DB.KEYS.APPS, apps);
        } else {
            // Fallback: localStorage
            const existing = JSON.parse(localStorage.getItem('bf_applications') || '[]');
            existing.push(submittedFormData);
            localStorage.setItem('bf_applications', JSON.stringify(existing));
        }

        // Show success modal
        const refEl = document.getElementById('success-ref');
        if (refEl) {
            refEl.textContent = 'রেফারেন্স ID: ' + submittedFormData.id;
        }

        const successModal = document.getElementById('successModal');
        if (successModal) successModal.classList.remove('hidden');

        // Clear draft
        localStorage.removeItem('bf_form_draft');

        showToast('আবেদন জমা হয়েছে! ✅', '#065F46');
    }

    function buildAddress() {
        const div = document.getElementById('addrDivision')?.value || '';
        const dist = document.getElementById('addrDistrict')?.value || '';
        const thana = document.getElementById('addrThana')?.value || '';
        const postSelect = document.getElementById('addrPost');
        const post = postSelect?.options[postSelect.selectedIndex]?.textContent || '';
        const code = document.getElementById('addrPostCode')?.value || '';
        const village = document.getElementById('addrVillage')?.value || '';
        return [village, post, code, thana, dist, div].filter(Boolean).join(', ');
    }

    function generateID() {
        const ts = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
        return 'BF-' + ts + '-' + rnd;
    }

    // ════════ PDF DOWNLOAD ════════

    async function downloadMemberPDF() {
        if (!submittedFormData) {
            showToast('কোনো ডেটা নেই', '#e53e3e');
            return;
        }

        // Check dependencies
        if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            showToast('PDF লাইব্রেরি লোড হয়নি', '#e53e3e');
            return;
        }

        showToast('পিডিএফ তৈরি হচ্ছে...', '#065F46');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const printDiv = buildPrintHTML(submittedFormData);
        document.body.appendChild(printDiv);

        try {
            const canvas = await html2canvas(printDiv, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 794
            });

            document.body.removeChild(printDiv);

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfW = 210;
            const pdfH = (canvas.height * 210) / canvas.width;
            const pageH = 297;

            let yPos = 0;
            let pageAdded = false;
            while (yPos < pdfH) {
                if (pageAdded) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, -yPos, pdfW, pdfH);
                yPos += pageH;
                pageAdded = true;
            }

            doc.save('barakah-finance-application-' + submittedFormData.id + '.pdf');
            showToast('পিডিএফ ডাউনলোড হয়েছে ✅', '#065F46');

        } catch (err) {
            if (document.body.contains(printDiv)) document.body.removeChild(printDiv);
            showToast('পিডিএফ তৈরিতে সমস্যা', '#e53e3e');
            console.error('PDF Error:', err);
        }
    }

    function buildPrintHTML(data) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: -9999px;
            left: 0;
            width: 794px;
            background: #fff;
            font-family: "Noto Serif Bengali", serif;
            color: #111;
            padding: 32px;
            box-sizing: border-box;
        `;

        const fmt = v => v || '—';

        div.innerHTML = `
            <div style="text-align:center;border-bottom:3px solid #C9A227;padding-bottom:16px;margin-bottom:20px;">
                <h1 style="font-size:22px;color:#064E3B;margin:0;">বারাকাহ ফাইন্যান্স – Barakah Finance</h1>
                <p style="color:#C9A227;margin:4px 0 2px;">সুদমুক্ত লেনদেনে সমৃদ্ধি সবার</p>
                <p style="font-size:11px;color:#666;">আদিতমারী, লালমনিরহাট | +8801581093611</p>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                <div>
                    <h2 style="font-size:16px;color:#064E3B;margin:0 0 6px;">সদস্য পদের জন্য আবেদন ফরম</h2>
                    <p style="font-size:11px;color:#555;margin:0;">রেফারেন্স: <strong>${data.id}</strong></p>
                    <p style="font-size:11px;color:#555;margin:2px 0 0;">জমার তারিখ: ${new Date(data.submittedAt).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    ${data.memberID ? `<p style="font-size:12px;color:#064E3B;font-weight:bold;margin:4px 0 0;">সদস্য আইডি: ${data.memberID}</p>` : ''}
                </div>
                ${data.photoData ? `<img src="${data.photoData}" style="width:80px;height:96px;object-fit:cover;border:2px solid #C9A227;border-radius:4px;" />` : '<div style="width:80px;height:96px;border:2px dashed #aaa;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa;">ছবি নেই</div>'}
            </div>

            <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:14px;margin-bottom:14px;">
                <h3 style="font-size:13px;background:#064E3B;color:#fff;padding:5px 10px;border-radius:4px;margin:0 0 10px;">১। আবেদনকারীর ব্যক্তিগত তথ্য</h3>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr><td style="padding:4px 8px;width:40%;color:#065F46;font-weight:600;">আবেদনকারীর নাম (বাং)</td><td style="padding:4px 8px;">${fmt(data.applicantNameBn)}</td><td style="padding:4px 8px;width:40%;color:#065F46;font-weight:600;">Name (Eng)</td><td style="padding:4px 8px;">${fmt(data.applicantNameEn)}</td></tr>
                    <tr style="background:#fff;"><td style="padding:4px 8px;color:#065F46;font-weight:600;">পিতার নাম (বাং)</td><td style="padding:4px 8px;">${fmt(data.fatherNameBn)}</td><td style="padding:4px 8px;color:#065F46;font-weight:600;">Father (Eng)</td><td style="padding:4px 8px;">${fmt(data.fatherNameEn)}</td></tr>
                    <tr><td style="padding:4px 8px;color:#065F46;font-weight:600;">মাতার নাম (বাং)</td><td style="padding:4px 8px;">${fmt(data.motherNameBn)}</td><td style="padding:4px 8px;color:#065F46;font-weight:600;">Mother (Eng)</td><td style="padding:4px 8px;">${fmt(data.motherNameEn)}</td></tr>
                    <tr style="background:#fff;"><td style="padding:4px 8px;color:#065F46;font-weight:600;">এনআইডি নম্বর</td><td style="padding:4px 8px;">${fmt(data.nidNumber)}</td><td style="padding:4px 8px;color:#065F46;font-weight:600;">জন্ম তারিখ</td><td style="padding:4px 8px;">${fmt(data.dob)}</td></tr>
                    <tr><td style="padding:4px 8px;color:#065F46;font-weight:600;">পেশা</td><td style="padding:4px 8px;">${fmt(data.occupation)}</td><td style="padding:4px 8px;color:#065F46;font-weight:600;">আয়ের উৎস</td><td style="padding:4px 8px;">${fmt(data.incomeSource)}</td></tr>
                    <tr style="background:#fff;"><td style="padding:4px 8px;color:#065F46;font-weight:600;">বর্তমান ঠিকানা</td><td colspan="3" style="padding:4px 8px;">${fmt(data.currentAddress)}</td></tr>
                    <tr><td style="padding:4px 8px;color:#065F46;font-weight:600;">স্থায়ী ঠিকানা</td><td colspan="3" style="padding:4px 8px;">${fmt(data.permanentAddress)}</td></tr>
                    <tr style="background:#fff;"><td style="padding:4px 8px;color:#065F46;font-weight:600;">মোবাইল নম্বর</td><td colspan="3" style="padding:4px 8px;">${(data.phones || []).join(' / ')}</td></tr>
                </table>
            </div>

            <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:14px;margin-bottom:14px;">
                <h3 style="font-size:13px;background:#064E3B;color:#fff;padding:5px 10px;border-radius:4px;margin:0 0 10px;">২। নমিনির তথ্য</h3>
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <tr><td style="padding:4px 8px;width:40%;color:#065F46;font-weight:600;">নমিনির নাম (বাং)</td><td style="padding:4px 8px;">${fmt(data.nomineeName_bn)}</td><td style="padding:4px 8px;width:30%;color:#065F46;font-weight:600;">Name (Eng)</td><td style="padding:4px 8px;">${fmt(data.nomineeName_en)}</td></tr>
                    <tr style="background:#fff;"><td style="padding:4px 8px;color:#065F46;font-weight:600;">সম্পর্ক</td><td style="padding:4px 8px;">${fmt(data.nomineeRelation)}</td><td style="padding:4px 8px;color:#065F46;font-weight:600;">মোবাইল</td><td style="padding:4px 8px;">${fmt(data.nomineePhone)}</td></tr>
                    <tr><td style="padding:4px 8px;color:#065F46;font-weight:600;">এনআইডি</td><td style="padding:4px 8px;">${fmt(data.nomineeNID)}</td><td style="padding:4px 8px;color:#065F46;font-weight:600;">ঠিকানা</td><td style="padding:4px 8px;">${fmt(data.nomineeAddress)}</td></tr>
                </table>
            </div>

            <div style="background:#fffbeb;border:1px solid #C9A227;border-radius:8px;padding:12px;font-size:11px;margin-bottom:16px;">
                <p style="font-weight:bold;margin:0 0 6px;color:#064E3B;">আর্থিক অঙ্গীকার ও শর্তাবলী:</p>
                <p style="margin:2px 0;">ক) প্রতি মাসের ১৫ তারিখের মধ্যে ২০০০ টাকা সঞ্চয় জমা দিতে বাধ্য থাকব।</p>
                <p style="margin:2px 0;">খ) নির্ধারিত সময়ে জমা না দিলে ১০০ টাকা বিলম্ব ফি প্রযোজ্য।</p>
                <p style="margin:2px 0;">গ) প্রাথমিক ৩ বছর সক্রিয় সদস্য থাকার প্রতিশ্রুতি।</p>
                <p style="margin:2px 0;">ঘ) সংস্থার শৃঙ্খলা লঙ্ঘনে সদস্যপদ বাতিলযোগ্য।</p>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">
                <div>
                    <p style="font-size:11px;color:#555;margin:0 0 4px;">আবেদনকারীর স্বাক্ষর:</p>
                    ${data.sigData ? `<img src="${data.sigData}" style="height:40px;width:150px;object-fit:contain;border-bottom:1px solid #333;" />` : '<div style="width:150px;border-bottom:1px solid #333;height:40px;"></div>'}
                    <p style="font-size:10px;color:#777;margin:2px 0 0;">${new Date(data.submittedAt).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div style="text-align:center;">
                    <p style="font-size:10px;color:#555;margin:0 0 4px;">অফিস ব্যবহারের জন্য</p>
                    <div style="border:1px solid #C9A227;padding:8px 20px;border-radius:4px;font-size:11px;">
                        <p style="margin:0;color:#064E3B;">সদস্য আইডি: ___________</p>
                        <p style="margin:4px 0 0;color:#064E3B;">অনুমোদনের তারিখ: ________</p>
                    </div>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;margin-top:20px;padding-top:12px;border-top:1px dashed #C9A227;font-size:10px;color:#555;text-align:center;">
                <div><div style="width:100px;border-bottom:1px solid #333;margin:0 auto 4px;height:30px;"></div><p>সাধারণ সম্পাদক</p><p style="color:#aaa;">(সুপারিশকারী)</p></div>
                <div><div style="width:100px;border-bottom:1px solid #333;margin:0 auto 4px;height:30px;"></div><p>সহ-সভাপতি</p><p style="color:#aaa;">(অনুমোদনকারী)</p></div>
                <div><div style="width:100px;border-bottom:1px solid #333;margin:0 auto 4px;height:30px;"></div><p>সভাপতি</p><p style="color:#aaa;">(চূড়ান্ত অনুমোদন)</p></div>
            </div>
        `;

        return div;
    }

    // ════════ AUTO-SAVE DRAFT ════════

    function autoSaveDraft() {
        try {
            const formElements = document.querySelectorAll('.form-input, .fi, select, textarea');
            const data = {};
            for (const el of formElements) {
                if (el.id) {
                    data[el.id] = el.value;
                }
            }
            localStorage.setItem('bf_form_draft', JSON.stringify(data));
        } catch (e) {
            // Ignore
        }
    }

    function restoreDraft() {
        try {
            const data = JSON.parse(localStorage.getItem('bf_form_draft') || 'null');
            if (data) {
                for (const [id, value] of Object.entries(data)) {
                    const el = document.getElementById(id);
                    if (el) el.value = value;
                }
                updateProgress();
            }
        } catch (e) {
            // Ignore
        }
    }

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', function () {
        // Check dependencies
        if (!isDBAvailable()) {
            if (DEBUG) console.warn('[Form] DB not available, using localStorage fallback');
        }
        if (!isBDDataAvailable()) {
            if (DEBUG) console.warn('[Form] BD_DATA not available, address dropdowns will not work');
        }

        initTheme();
        setDate();

        if (isBDDataAvailable()) {
            populateDivisions();
        }

        updateStepBar(0);

        // Auto-save draft on input
        document.querySelectorAll('.form-input, .fi, select, textarea')
            .forEach(el => el.addEventListener('input', autoSaveDraft));

        // Restore draft
        restoreDraft();

        // Update progress on change
        document.querySelectorAll('.form-input, input[type="checkbox"], input[type="file"]')
            .forEach(el => el.addEventListener('change', updateProgress));

        if (DEBUG) {
            console.log('[Form] Initialized');
        }
    });

    // ── Expose globally ──
    window.initTheme = initTheme;
    window.toggleTheme = toggleTheme;
    window.changeLanguage = changeLanguage;
    window.setDate = setDate;
    window.updateProgress = updateProgress;
    window.updateStepBar = updateStepBar;
    window.handleOccChange = handleOccChange;
    window.populateDivisions = populateDivisions;
    window.populateDistricts = populateDistricts;
    window.populateThanas = populateThanas;
    window.populatePostOffices = populatePostOffices;
    window.fillPostCode = fillPostCode;
    window.copyCurrAddr = copyCurrAddr;
    window.addPhoneField = addPhoneField;
    window.validatePhone = validatePhone;
    window.handleDrag = handleDrag;
    window.handleDragLeave = handleDragLeave;
    window.handleDrop = handleDrop;
    window.handleNIDUpload = handleNIDUpload;
    window.openCropper = openCropper;
    window.closeCropper = closeCropper;
    window.cropAndSave = cropAndSave;
    window.submitFormData = submitFormData;
    window.downloadMemberPDF = downloadMemberPDF;
    window.showToast = showToast;

})();