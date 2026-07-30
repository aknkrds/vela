/* app.js */
document.addEventListener('DOMContentLoaded', () => {
    // 0. Dynamic Currency Conversion Configuration (Base Currency: TRY)
    const basePricesTRY = {
        free: 0,
        basic: 99,
        silver: 199,
        gold: 249,
        diamond: 309,
        blue_diamond: 399,
        platinum: 599,
        galaxy: 999,
        extra_user: 66 // (~2 USD)
    };

    const currencyMap = {
        tr: { code: 'TRY', symbol: 'TL' },
        en: { code: 'USD', symbol: '$' },
        de: { code: 'EUR', symbol: '€' },
        it: { code: 'EUR', symbol: '€' },
        fr: { code: 'EUR', symbol: '€' },
        es: { code: 'EUR', symbol: '€' },
        ar: { code: 'SAR', symbol: '﷼' },
        hi: { code: 'INR', symbol: '₹' },
        ko: { code: 'KRW', symbol: '₩' },
        ja: { code: 'JPY', symbol: '¥' },
        zh: { code: 'CNY', symbol: '¥' },
        ru: { code: 'RUB', symbol: '₽' }
    };

    // Direct exchange rates (relative to TRY) fallback
    const fallbackRates = {
        TRY: 1.0,
        USD: 0.030,
        EUR: 0.027,
        SAR: 0.11,
        INR: 2.53,
        KRW: 41.5,
        JPY: 4.75,
        CNY: 0.22,
        RUB: 2.65
    };

    let exchangeRates = { ...fallbackRates };

    // Fetch live currency rates with fallback
    async function fetchExchangeRates() {
        try {
            // Fetch live rates with TRY as base
            const response = await fetch('https://open.er-api.com/v6/latest/TRY');
            if (!response.ok) throw new Error('API response failed');
            const data = await response.json();
            if (data && data.rates) {
                for (const currency in fallbackRates) {
                    if (data.rates[currency]) {
                        exchangeRates[currency] = data.rates[currency];
                    }
                }
                console.log('Live exchange rates loaded (Base TRY):', exchangeRates);
                if (typeof currentLanguage !== 'undefined') {
                    updateDynamicPrices(currentLanguage);
                }
            }
        } catch (error) {
            console.warn('Failed to fetch live exchange rates, using fallbacks:', error);
        }
    }

    // Call API async
    fetchExchangeRates();

    function updateDynamicPrices(lang) {
        const config = currencyMap[lang] || currencyMap['en'];
        const rate = exchangeRates[config.code] || fallbackRates[config.code] || 1.0;
        
        document.querySelectorAll('[data-price-tier]').forEach(el => {
            const tier = el.getAttribute('data-price-tier');
            const baseTry = basePricesTRY[tier];
            if (baseTry === undefined) return;
            
            let convertedVal = 0;
            if (baseTry > 0) {
                if (config.code === 'TRY') {
                    convertedVal = baseTry;
                } else {
                    convertedVal = Math.round(baseTry * rate * 1.05); // Direct conversion with 5% margin
                }
            }
            
            if (el.classList.contains('price-val')) {
                if (tier === 'free') {
                    el.innerHTML = `0 <span>${config.symbol}</span>`;
                } else {
                    el.innerHTML = `${convertedVal} <span>${config.symbol}</span>`;
                }
            } else if (el.classList.contains('price-badge')) {
                if (tier === 'free') {
                    const freeText = translations[lang]?.pricing_free_badge || 'Sonsuza Kadar Free';
                    el.textContent = `0 ${config.symbol} / ${freeText}`;
                }
            } else {
                if (tier === 'free') {
                    el.textContent = `0 ${config.symbol}`;
                } else {
                    el.textContent = `${convertedVal} ${config.symbol}`;
                }
            }
        });

        // Update disclaimer 4 note text
        const extraUserDescEl = document.querySelector('[data-i18n="pricing_disc_desc4"]');
        if (extraUserDescEl) {
            let extraUserPrice = basePricesTRY.extra_user;
            if (config.code !== 'TRY') {
                extraUserPrice = Math.round(basePricesTRY.extra_user * rate * 1.05);
            }
            const originalDesc = translations[lang]?.pricing_disc_desc4 || '';
            const noteText = lang === 'en' ? '' : ` (≈ ${extraUserPrice} ${config.symbol})`;
            extraUserDescEl.textContent = originalDesc + noteText;
        }
    }

    // 1. Sticky Navbar & Scroll Events
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            // Toggle hamburger animation
            const spans = menuToggle.querySelectorAll('span');
            spans[0].style.transform = navLinks.classList.contains('active') ? 'rotate(45deg) translate(6px, 6px)' : 'none';
            spans[1].style.opacity = navLinks.classList.contains('active') ? '0' : '1';
            spans[2].style.transform = navLinks.classList.contains('active') ? 'rotate(-45deg) translate(6px, -6px)' : 'none';
        });

        // Close mobile menu on link click
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                const spans = menuToggle.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            });
        });
    }

    // 3. FAQ Accordion Functionality
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const trigger = item.querySelector('.faq-trigger');
        trigger.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all active items
            faqItems.forEach(el => el.classList.remove('active'));
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });

        // FAQ Link Sharing Copy Button
        const shareBtn = item.querySelector('.faq-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent accordion from toggling
                const faqId = item.getAttribute('id') || 'faq-1';
                const shareUrl = `${window.location.origin}${window.location.pathname}#${faqId}`;
                
                navigator.clipboard.writeText(shareUrl).then(() => {
                    const copiedMsg = translations[currentLanguage]?.toast_link_copied || 'Panoya kopyalandı!';
                    showToast(copiedMsg, 'success');
                }).catch(err => {
                    console.error('Clipboard copy error:', err);
                });
            });
        }
    });

    // 4. FAQ Search and Category Filtering
    const faqSearchInput = document.getElementById('faq-search');
    const faqCategoryButtons = document.querySelectorAll('.faq-cat-btn');
    const faqNoResults = document.querySelector('.faq-no-results');
    
    let activeCategory = 'all';
    let searchQuery = '';

    function filterFAQ() {
        let visibleCount = 0;

        faqItems.forEach(item => {
            const questionText = item.querySelector('.faq-trigger').textContent.toLowerCase();
            const answerText = item.querySelector('.faq-content-inner').textContent.toLowerCase();
            const matchesSearch = questionText.includes(searchQuery) || answerText.includes(searchQuery);
            
            const itemCategory = item.getAttribute('data-category');
            const matchesCategory = activeCategory === 'all' || itemCategory === activeCategory;

            if (matchesSearch && matchesCategory) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
                item.classList.remove('active'); // Close if hidden
            }
        });

        if (faqNoResults) {
            faqNoResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    if (faqSearchInput) {
        faqSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            filterFAQ();
        });
    }

    faqCategoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            faqCategoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.getAttribute('data-category');
            filterFAQ();
        });
    });

    // 5. Form Switcher (Tabs)
    const tabButtons = document.querySelectorAll('.form-tab-btn');
    const formPanes = document.querySelectorAll('.form-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Update active states for buttons
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active states for form panels
            formPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `${targetTab}-pane`) {
                    pane.classList.add('active');
                }
            });
        });
    });

    // 6. Toast Notification Helper
    const toastContainer = document.getElementById('toast-container');
    
    function showToast(message, type = 'success') {
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = type === 'success' ? '✓' : '✗';
        
        const text = document.createElement('span');
        text.className = 'toast-text';
        text.textContent = message;
        
        toast.appendChild(icon);
        toast.appendChild(text);
        toastContainer.appendChild(toast);
        
        // Trigger reflow for transition
        toast.offsetHeight;
        toast.classList.add('show');
        
        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 4000);
    }

    // 7. Form Submission Handler via FormSubmit AJAX API
    const forms = {
        contact: document.getElementById('contact-form'),
        support: document.getElementById('support-form'),
        delete: document.getElementById('delete-form')
    };

    const recipientEmail = 'info@symi.com.tr';

    // Language Selection Configuration
    const langConfig = {
        tr: { flag: '🇹🇷', name: 'Türkçe' },
        en: { flag: '🇺🇸', name: 'English' },
        de: { flag: '🇩🇪', name: 'Deutsch' },
        it: { flag: '🇮🇹', name: 'Italiano' },
        fr: { flag: '🇫🇷', name: 'Français' },
        es: { flag: '🇪🇸', name: 'Español' },
        ar: { flag: '🇸🇦', name: 'العربية' },
        hi: { flag: '🇮🇳', name: 'हिन्दी' },
        ko: { flag: '🇰🇷', name: '한국어' },
        ja: { flag: '🇯🇵', name: '日本語' },
        zh: { flag: '🇨🇳', name: '中文' },
        ru: { flag: '🇷🇺', name: 'Русский' }
    };

    let currentLanguage = 'tr';

    // Helper to format deletion checkbox with active link
    function getConfirmHTML(lang, rawText) {
        const keywords = {
            tr: "Kullanıcı Sözleşmesi ve Gizlilik Politikası",
            en: "User Agreement and Privacy Policy",
            de: "Datenschutzbestimmungen",
            it: "condizioni sulla privacy",
            fr: "conditions de confidentialité",
            es: "términos de privacidad",
            ar: "شروط الخصوصية",
            hi: "गोpनीयता शर्तों", // standard fallback below handles it
            ko: "이용약관 및 개인정보 취급방침",
            ja: "プライバシーポリシー",
            zh: "隐私保护条例与使用契约",
            ru: "условия конфиденциальности"
        };
        const phrase = keywords[lang];
        if (phrase && rawText.includes(phrase)) {
            return rawText.replace(phrase, `<a href="javascript:void(0)" class="open-privacy-link" style="color: var(--primary); text-decoration: underline;">${phrase}</a>`);
        }
        // Fallback for Hindi or any partial match
        if (lang === 'hi') {
            return rawText.replace("गोपनीयता शर्तों", `<a href="javascript:void(0)" class="open-privacy-link" style="color: var(--primary); text-decoration: underline;">गोपनीयता शर्तों</a>`);
        }
        return rawText;
    }

    // Main translation engine
    function setLanguage(lang) {
        if (!translations[lang]) return;
        currentLanguage = lang;
        localStorage.setItem('vela-lang', lang);

        // Toggle page direction
        if (lang === 'ar') {
            document.documentElement.setAttribute('dir', 'rtl');
            document.documentElement.setAttribute('lang', 'ar');
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
            document.documentElement.setAttribute('lang', lang);
        }

        // Update active dropdown button in navbar
        const activeFlagEl = document.querySelector('.active-flag');
        const activeLangNameEl = document.querySelector('.active-lang-name');
        if (activeFlagEl && activeLangNameEl && langConfig[lang]) {
            activeFlagEl.textContent = langConfig[lang].flag;
            activeLangNameEl.textContent = langConfig[lang].name;
        }

        // Translate nodes with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[lang][key]) {
                // If it is the pricing expand button, check status
                if (key === 'pricing_expand_btn') {
                    const isExpanded = detailedTiersContainer && detailedTiersContainer.classList.contains('active');
                    const labelKey = isExpanded ? 'pricing_expand_btn_active' : 'pricing_expand_btn';
                    const arrow = isExpanded ? '↑' : '↓';
                    element.innerHTML = `<span data-i18n="pricing_expand_btn">${translations[lang][labelKey]}</span> <span class="expand-icon">${arrow}</span>`;
                } else if (key === 'form_delete_confirm') {
                    element.innerHTML = getConfirmHTML(lang, translations[lang][key]);
                } else {
                    element.textContent = translations[lang][key];
                }
            }
        });

        // Translate inputs placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (translations[lang][key]) {
                element.setAttribute('placeholder', translations[lang][key]);
            }
        });

        // Translate select inputs default values
        const catDefault = document.querySelector('#support-category option[value=""]');
        if (catDefault && translations[lang]['form_select_cat']) {
            catDefault.textContent = translations[lang]['form_select_cat'];
        }
        const reasonDefault = document.querySelector('#delete-reason option[value=""]');
        if (reasonDefault && translations[lang]['form_select_reason']) {
            reasonDefault.textContent = translations[lang]['form_select_reason'];
        }
        
        // Handle mockup check-in override translations
        const checkinBtn = document.querySelector('.mockup-checkin-btn');
        if (checkinBtn && checkinBtn.classList.contains('checked-in')) {
            const mockupStreakEl = document.querySelector('.mockup-streak-badge span:last-child');
            const mockupStatusValueEl = document.querySelector('.mockup-status-time');
            // Select countdown label precisely
            const mockupStatusCountdownEl = document.querySelector('.mockup-status-card div[style*="font-size: 0.65rem"]');
            
            checkinBtn.textContent = translations[lang]['mockup_checkin_done'] || 'Checked In';
            if (mockupStreakEl) {
                mockupStreakEl.textContent = translations[lang]['mockup_streak_val'] || '13 Days';
            }
            if (mockupStatusValueEl) {
                mockupStatusValueEl.textContent = translations[lang]['mockup_checkin_done'] || 'Checked In';
            }
            if (mockupStatusCountdownEl) {
                mockupStatusCountdownEl.textContent = translations[lang]['mockup_checkin_next'] || 'Next Check-in: 24 Hours Left';
            }
        }
        
        // Update prices dynamically based on currency
        updateDynamicPrices(lang);

        // Re-run search/filtering if user has already searched inside FAQ
        if (faqSearchInput && faqSearchInput.value) {
            searchQuery = faqSearchInput.value.toLowerCase().trim();
            filterFAQ();
        }
    }

    // Submit listener for each form with multi-language validation and toast messages
    Object.keys(forms).forEach(formKey => {
        const form = forms[formKey];
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form elements
            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.spinner');
            
            // Validation check (e.g. checkbox for deletion confirmation)
            if (formKey === 'delete') {
                const confirmCheckbox = document.getElementById('confirm-delete');
                if (confirmCheckbox && !confirmCheckbox.checked) {
                    const warnMsg = translations[currentLanguage]?.toast_validation_delete || 'Lütfen silme koşullarını onaylayın.';
                    showToast(warnMsg, 'error');
                    return;
                }
            }

            // Set loading state
            submitBtn.disabled = true;
            if (spinner) spinner.style.display = 'inline-block';
            
            // Prepare Form Data
            const formData = new FormData(form);
            
            // Add custom subject or email format fields for FormSubmit
            let formSubject = 'Vela Web Sitesi - Yeni Form Gönderimi';
            if (formKey === 'contact') {
                formSubject = `Vela İletişim: ${formData.get('subject') || 'Genel Konu'}`;
            } else if (formKey === 'support') {
                formSubject = `Vela Destek Talebi: ${formData.get('category') || 'Teknik Sorun'} [Bilet ID: ${formData.get('ticket_id') || 'Yeni'}]`;
            } else if (formKey === 'delete') {
                formSubject = `ACİL - Vela Üyelik Silme Talebi: ${formData.get('email')}`;
            }
            
            formData.append('_subject', formSubject);
            formData.append('_template', 'table');
            formData.append('_captcha', 'false'); // AJAX Mode

            try {
                // Submit to FormSubmit AJAX endpoint
                const response = await fetch(`https://formsubmit.co/ajax/${recipientEmail}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                const result = await response.json();
                
                if (response.ok && result.success === 'true') {
                    // Success handling
                    let successMsg = '';
                    if (formKey === 'delete') {
                        successMsg = translations[currentLanguage]?.toast_success_delete || 'Üyelik silme talebiniz alınmıştır.';
                    } else if (formKey === 'support') {
                        successMsg = translations[currentLanguage]?.toast_success_support || 'Destek talebiniz iletilmiştir.';
                    } else {
                        successMsg = translations[currentLanguage]?.toast_success_contact || 'Mesajınız başarıyla iletildi.';
                    }
                    showToast(successMsg, 'success');
                    form.reset();
                } else {
                    throw new Error('API returns error response.');
                }
            } catch (error) {
                console.error('Form submission error:', error);
                const errorMsg = translations[currentLanguage]?.toast_error || 'Gönderim sırasında hata oluştu.';
                showToast(errorMsg, 'error');
            } finally {
                // Restore button state
                submitBtn.disabled = false;
                if (spinner) spinner.style.display = 'none';
            }
        });
    });

    // 8. Pricing Expandable Tiers
    const expandTiersTrigger = document.getElementById('expand-tiers-trigger');
    const detailedTiersContainer = document.getElementById('detailed-tiers-container');
    
    if (expandTiersTrigger && detailedTiersContainer) {
        expandTiersTrigger.addEventListener('click', () => {
            const isActive = detailedTiersContainer.classList.contains('active');
            detailedTiersContainer.classList.toggle('active');
            expandTiersTrigger.classList.toggle('active');
            
            const btnText = expandTiersTrigger.querySelector('span');
            const btnIcon = expandTiersTrigger.querySelector('.expand-icon');
            
            if (isActive) {
                btnText.textContent = translations[currentLanguage]?.pricing_expand_btn || 'Tüm Paketleri ve Özellikleri Karşılaştır';
                btnIcon.textContent = '↓';
            } else {
                btnText.textContent = translations[currentLanguage]?.pricing_expand_btn_active || 'Karşılaştırma Tablosunu Gizle';
                btnIcon.textContent = '↑';
            }
        });
    }

    // 9. Privacy & Terms Modal Popup
    const privacyModal = document.getElementById('privacy-modal');
    const closePrivacyBtn = document.getElementById('privacy-modal-close');
    const agreePrivacyBtn = document.getElementById('privacy-modal-agree');
    
    function openModal() {
        if (privacyModal) {
            privacyModal.style.display = 'flex';
            privacyModal.offsetHeight;
            privacyModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }
    
    function closeModal() {
        if (privacyModal) {
            privacyModal.classList.remove('open');
            setTimeout(() => {
                privacyModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }, 300);
        }
    }
    
    // Listen for privacy links dynamically using event delegation (handles dynamically translated confirm checkboxes)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('open-privacy-link')) {
            e.preventDefault();
            openModal();
        }
    });
    
    if (closePrivacyBtn) {
        closePrivacyBtn.addEventListener('click', closeModal);
    }
    
    if (agreePrivacyBtn) {
        agreePrivacyBtn.addEventListener('click', () => {
            closeModal();
            // Auto-check deletion checkbox on modal agreement
            const deleteCheckbox = document.getElementById('confirm-delete');
            if (deleteCheckbox) deleteCheckbox.checked = true;
        });
    }
    
    // Close modal when clicking outside the modal content card
    if (privacyModal) {
        privacyModal.addEventListener('click', (e) => {
            if (e.target === privacyModal) {
                closeModal();
            }
        });
    }

    // 10. Language Switcher Interactions
    const langDropdownBtn = document.getElementById('lang-dropdown-btn');
    const langDropdown = document.querySelector('.lang-dropdown');
    
    if (langDropdownBtn && langDropdown) {
        langDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('open');
        });
        
        // Close when clicking outside dropdown
        document.addEventListener('click', () => {
            langDropdown.classList.remove('open');
        });
    }

    // Bind dropdown click options
    document.querySelectorAll('.lang-dropdown-content a').forEach(a => {
        a.addEventListener('click', (e) => {
            const selectedLang = a.getAttribute('data-lang');
            setLanguage(selectedLang);
            if (langDropdown) {
                langDropdown.classList.remove('open');
            }
        });
    });

    // 11. First-Load Language Setup
    const firstLoadModal = document.getElementById('first-load-lang-modal');
    if (firstLoadModal) {
        const savedLang = localStorage.getItem('vela-lang');
        if (!savedLang) {
            // First time load: show selection popup modal
            firstLoadModal.style.display = 'flex';
            firstLoadModal.offsetHeight;
            firstLoadModal.classList.add('open');
            document.body.style.overflow = 'hidden';

            // Auto-detect user browser language on first load
            const browserLangCode = (navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase();
            const supportedLangs = ['tr', 'en', 'de', 'it', 'fr', 'es', 'ar', 'hi', 'ko', 'ja', 'zh', 'ru'];
            let defaultLang = 'en';
            if (supportedLangs.includes(browserLangCode)) {
                defaultLang = browserLangCode;
            }
            setLanguage(defaultLang);
        } else {
            // Standard load: apply previously stored language
            setLanguage(savedLang);
        }

        // Modal selector cards event handlers
        firstLoadModal.querySelectorAll('.lang-select-box').forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedLang = btn.getAttribute('data-lang');
                setLanguage(selectedLang);
                
                // Hide modal with transition
                firstLoadModal.classList.remove('open');
                setTimeout(() => {
                    firstLoadModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }, 300);
            });
        });
    }

    // 12. Interactive Mockup Check-in Simulator
    const mockupCheckinBtn = document.querySelector('.mockup-checkin-btn');
    const mockupStreakEl = document.querySelector('.mockup-streak-badge span:last-child');
    const mockupStatusValueEl = document.querySelector('.mockup-status-time');
    const mockupStatusCountdownEl = document.querySelector('.mockup-status-card div[style*="font-size: 0.65rem"]');
    
    if (mockupCheckinBtn) {
        mockupCheckinBtn.addEventListener('click', () => {
            if (mockupCheckinBtn.classList.contains('checked-in')) return;
            
            mockupCheckinBtn.classList.add('checked-in');
            mockupCheckinBtn.style.background = '#10b981';
            mockupCheckinBtn.style.borderColor = '#10b981';
            mockupCheckinBtn.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.4)';
            mockupCheckinBtn.textContent = translations[currentLanguage]?.mockup_checkin_done || 'Checked In';
            
            // Increment streak
            if (mockupStreakEl) {
                mockupStreakEl.textContent = translations[currentLanguage]?.mockup_streak_val || '13 Days';
                const streakBadge = document.querySelector('.mockup-streak-badge');
                if (streakBadge) {
                    streakBadge.style.transform = 'scale(1.2) rotate(5deg)';
                    streakBadge.style.transition = 'transform 0.2s ease-out';
                    setTimeout(() => {
                        streakBadge.style.transform = 'scale(1)';
                    }, 250);
                }
            }
            
            // Update status time & countdown
            if (mockupStatusValueEl) {
                mockupStatusValueEl.style.color = '#10b981';
                mockupStatusValueEl.textContent = translations[currentLanguage]?.mockup_checkin_done || 'Checked In';
            }
            if (mockupStatusCountdownEl) {
                mockupStatusCountdownEl.textContent = translations[currentLanguage]?.mockup_checkin_next || 'Next Check-in: 24 Hours Left';
            }
            
            // Show toast success
            const successMsg = translations[currentLanguage]?.mockup_checkin_success || 'Check-in successful!';
            showToast(successMsg, 'success');
        });
    }

    // 13. SSO Social Verification Simulator
    const googleSsoBtn = document.getElementById('sso-google-btn');
    const appleSsoBtn = document.getElementById('sso-apple-btn');
    
    const handleSsoClick = () => {
        const msg = translations[currentLanguage]?.toast_sso_sim || 'Sosyal kimlik doğrulaması simülasyonu başlatıldı.';
        showToast(msg, 'success');
    };

    if (googleSsoBtn) googleSsoBtn.addEventListener('click', handleSsoClick);
    if (appleSsoBtn) appleSsoBtn.addEventListener('click', handleSsoClick);
});



