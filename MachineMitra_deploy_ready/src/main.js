// MachineMitra - SaaS Main Application Logic
// Track machines. Track money.

// ----------------------------------------------------
// FIREBASE AUTH DYNAMIC LOADER & STATE
// ----------------------------------------------------
let firebaseApp = null;
let firebaseAuth = null;
let firebaseConfirmationResult = null;
let recaptchaVerifier = null;
let isMockAuth = true;

// ----------------------------------------------------
// APPLICATION STATE
// ----------------------------------------------------
let state = {
  user: null, // Phone number
  userName: '', // Onboarding Name
  businessName: '', // Onboarding Business Name
  machines: [],
  workEntries: [],
  payments: [],
  expenses: []
};

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initThemeColor();
  loadFirebaseConfig();
  loadState();
  initSplashAndCheckAuth();
  initNavigation();
  initBottomSheetEvents();
  initFormCalculations();
  initProfileEvents();
  initInvoiceEvents();
  
  // Set initial date in header
  updateHeaderDate();
});

// Update status bar clock
function initClock() {
  const clockEl = document.getElementById('statusBarTime');
  const updateTime = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hrs}:${mins}`;
  };
  updateTime();
  setInterval(updateTime, 60000);
}

function initThemeColor() {
  document.documentElement.style.setProperty('--primary', '#FF7A00');
  document.documentElement.style.setProperty('--secondary', '#0B132B');
}

function updateHeaderDate() {
  const dateEl = document.getElementById('headerDate');
  if (dateEl) {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-IN', options);
  }
}

// Splash Screen Loader
function initSplashAndCheckAuth() {
  const splash = document.getElementById('splashScreen');
  
  setTimeout(() => {
    // Fade out splash
    splash.classList.add('fade-out');
    
    // Check Auth State
    const authScreen = document.getElementById('authScreen');
    if (state.user) {
      if (state.userName) {
        authScreen.style.display = 'none';
        switchScreen('screenHome');
        renderApp();
      } else {
        // Logged in but onboarding not finished
        authScreen.style.display = 'flex';
        document.getElementById('authPhoneStep').style.display = 'none';
        document.getElementById('authOtpStep').style.display = 'none';
        document.getElementById('authOnboardingStep').style.display = 'flex';
        initAuthFlow();
      }
    } else {
      authScreen.style.display = 'flex';
      document.getElementById('authPhoneStep').style.display = 'flex';
      document.getElementById('authOtpStep').style.display = 'none';
      document.getElementById('authOnboardingStep').style.display = 'none';
      initAuthFlow();
    }
  }, 1500);
}

// ----------------------------------------------------
// STATE MANAGEMENT & LOCAL STORAGE
// ----------------------------------------------------
function saveState() {
  localStorage.setItem('mm_app_state', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('mm_app_state');
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing state", e);
    }
  }
  
  // Default values check
  if (!state.userName) state.userName = '';
  if (!state.businessName) state.businessName = '';
  if (!state.machines) state.machines = [];
  if (!state.workEntries) state.workEntries = [];
  if (!state.payments) state.payments = [];
  if (!state.expenses) state.expenses = [];
}

// ----------------------------------------------------
// FIREBASE CONFIGURATION
// ----------------------------------------------------
function loadFirebaseConfig() {
  const savedConfig = localStorage.getItem('mm_firebase_config');
  const fbConfig = savedConfig ? JSON.parse(savedConfig) : null;
  
  // Update Profile screen inputs if config exists
  if (fbConfig) {
    document.getElementById('fbApiKey').value = fbConfig.apiKey || '';
    document.getElementById('fbAuthDomain').value = fbConfig.authDomain || '';
    document.getElementById('fbProjectId').value = fbConfig.projectId || '';
    document.getElementById('fbAppId').value = fbConfig.appId || '';
  }
  
  if (fbConfig && fbConfig.apiKey && fbConfig.projectId) {
    isMockAuth = false;
    showLoading(true);
    
    // Import from Firebase CDN v10.8.0
    Promise.all([
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
    ]).then(([{ initializeApp }, { getAuth, RecaptchaVerifier }]) => {
      try {
        firebaseApp = initializeApp(fbConfig);
        firebaseAuth = getAuth(firebaseApp);
        
        // Setup Recaptcha
        recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log("Recaptcha verified");
          }
        });
        
        console.log("Firebase Auth Initialized Successfully");
        showLoading(false);
      } catch (e) {
        showLoading(false);
        showToast("Firebase Config error: " + e.message, "error");
        isMockAuth = true;
      }
    }).catch(err => {
      showLoading(false);
      showToast("Failed to load Firebase libraries. Running in mock mode.", "info");
      isMockAuth = true;
    });
  } else {
    isMockAuth = true;
    console.log("No Firebase config found. Running in simulation mode.");
  }
}

// ----------------------------------------------------
// ROUTING & SCREEN TRANSITIONS (SaaS Synchronized)
// ----------------------------------------------------
function switchScreen(screenId) {
  // Hide all screens
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  
  // Show target screen
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  
  // Update Bottom Nav active state (Mobile layout)
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-target') === screenId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Update Top Nav active state (Desktop layout)
  const desktopNavItems = document.querySelectorAll('.desktop-nav-item');
  desktopNavItems.forEach(item => {
    if (item.getAttribute('data-target') === screenId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function initNavigation() {
  // Setup bottom navigation tab triggers
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (!state.user || !state.userName) return; // block navigation until onboarded
      const target = item.getAttribute('data-target');
      switchScreen(target);
      renderApp();
    });
  });
  
  // Setup top header desktop nav triggers
  const desktopNavItems = document.querySelectorAll('.desktop-nav-item');
  desktopNavItems.forEach(item => {
    item.addEventListener('click', () => {
      if (!state.user || !state.userName) return;
      const target = item.getAttribute('data-target');
      switchScreen(target);
      renderApp();
    });
  });
  
  // Home see all link
  const seeAllWorkBtn = document.getElementById('btnHomeSeeAllWork');
  if (seeAllWorkBtn) {
    seeAllWorkBtn.addEventListener('click', () => {
      switchScreen('screenWork');
    });
  }
}

// ----------------------------------------------------
// AUTHENTICATION & ONBOARDING FLOW
// ----------------------------------------------------
let resendTimer = null;
let secondsRemaining = 30;

function initAuthFlow() {
  const btnRequestOtp = document.getElementById('btnRequestOtp');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');
  const btnBackToPhone = document.getElementById('btnBackToPhone');
  const btnResendOtp = document.getElementById('btnResendOtp');
  const btnSubmitOnboarding = document.getElementById('btnSubmitOnboarding');
  const phoneInput = document.getElementById('loginPhoneNumber');

  // Request OTP click
  btnRequestOtp.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    if (!/^\d{10}$/.test(phone)) {
      showToast("Enter a valid 10-digit mobile number", "error");
      phoneInput.focus();
      return;
    }
    sendOtpSms(phone);
  });

  // Verify OTP click
  btnVerifyOtp.addEventListener('click', () => {
    const code = getOtpCode();
    if (code.length !== 6) {
      showToast("Enter all 6 digits of the OTP code", "error");
      return;
    }
    verifyOtpCode(code);
  });
  
  // Go back to phone screen
  btnBackToPhone.addEventListener('click', () => {
    document.getElementById('authOtpStep').style.display = 'none';
    document.getElementById('authPhoneStep').style.display = 'flex';
    clearInterval(resendTimer);
  });
  
  // Resend OTP click
  btnResendOtp.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    sendOtpSms(phone);
  });

  // Onboarding submit click
  btnSubmitOnboarding.addEventListener('click', () => {
    const name = document.getElementById('onboardingName').value.trim();
    const businessName = document.getElementById('onboardingBusiness').value.trim();
    
    if (!name) {
      showToast("Please enter your name", "error");
      document.getElementById('onboardingName').focus();
      return;
    }
    
    state.userName = name;
    state.businessName = businessName;
    saveState();
    
    // Hide auth screen and access app
    document.getElementById('authScreen').style.display = 'none';
    showToast("Profile completed! Welcome.", "success");
    
    switchScreen('screenHome');
    renderApp();
  });

  // OTP inputs auto-advance & validation
  const otpInputs = document.querySelectorAll('.otp-digit');
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = input.value;
      if (val && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  if (otpInputs[0]) {
    otpInputs[0].addEventListener('paste', (e) => {
      const pasted = e.clipboardData.getData('text').trim();
      if (/^\d{6}$/.test(pasted)) {
        for (let i = 0; i < 6; i++) {
          otpInputs[i].value = pasted[i];
        }
        otpInputs[5].focus();
        e.preventDefault();
      }
    });
  }

  // Web OTP API integration
  if ('OTPCredential' in window) {
    const ac = new AbortController();
    navigator.credentials.get({
      otp: { transport: ['sms'] },
      signal: ac.signal
    }).then(otp => {
      if (otp && otp.code) {
        for (let i = 0; i < 6; i++) {
          if (otpInputs[i]) otpInputs[i].value = otp.code[i] || '';
        }
        verifyOtpCode(otp.code);
      }
    }).catch(err => {
      console.log("Web OTP error: ", err);
    });
  }
}

// Request OTP SMS sending logic
function sendOtpSms(phone) {
  showLoading(true);
  const formattedPhone = `+91${phone}`;
  document.getElementById('displaySentNumber').textContent = formattedPhone;
  
  if (isMockAuth) {
    // Simulated SMS Flow
    setTimeout(() => {
      showLoading(false);
      document.getElementById('authPhoneStep').style.display = 'none';
      document.getElementById('authOtpStep').style.display = 'flex';
      showToast("Demo Mode: SMS sent! Use OTP: 123456", "info");
      startResendCountdown();
    }, 1200);
  } else {
    // Real Firebase SMS Flow
    import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
      .then(({ signInWithPhoneNumber }) => {
        signInWithPhoneNumber(firebaseAuth, formattedPhone, recaptchaVerifier)
          .then((confirmationResult) => {
            showLoading(false);
            firebaseConfirmationResult = confirmationResult;
            document.getElementById('authPhoneStep').style.display = 'none';
            document.getElementById('authOtpStep').style.display = 'flex';
            showToast("SMS OTP sent successfully!", "success");
            startResendCountdown();
          })
          .catch((error) => {
            showLoading(false);
            showToast("SMS Send Error: " + error.message, "error");
            console.error(error);
          });
      });
  }
}

// Verify OTP logic
function verifyOtpCode(code) {
  showLoading(true);
  const phone = document.getElementById('loginPhoneNumber').value.trim();
  const formattedPhone = `+91${phone}`;
  
  const proceedToAppOrOnboarding = () => {
    state.user = formattedPhone;
    saveState();
    
    // Check onboarding
    if (state.userName) {
      document.getElementById('authScreen').style.display = 'none';
      switchScreen('screenHome');
      showToast("Logged in successfully", "success");
      renderApp();
    } else {
      // Show Onboarding step
      document.getElementById('authOtpStep').style.display = 'none';
      document.getElementById('authOnboardingStep').style.display = 'flex';
    }
  };
  
  if (isMockAuth) {
    setTimeout(() => {
      showLoading(false);
      if (code === '123456') {
        proceedToAppOrOnboarding();
      } else {
        showToast("Invalid verification code. Try '123456'.", "error");
        clearOtpInputs();
      }
    }, 800);
  } else {
    // Real Firebase OTP verification
    firebaseConfirmationResult.confirm(code)
      .then((result) => {
        showLoading(false);
        proceedToAppOrOnboarding();
      })
      .catch((error) => {
        showLoading(false);
        showToast("Invalid code: " + error.message, "error");
        clearOtpInputs();
      });
  }
}

function startResendCountdown() {
  clearInterval(resendTimer);
  secondsRemaining = 30;
  const timerTextEl = document.getElementById('otpTimerSeconds');
  const timerLabel = document.getElementById('otpCountdownText');
  const resendBtn = document.getElementById('btnResendOtp');
  
  timerLabel.style.display = 'inline';
  resendBtn.style.display = 'none';
  timerTextEl.textContent = secondsRemaining;
  
  resendTimer = setInterval(() => {
    secondsRemaining--;
    timerTextEl.textContent = secondsRemaining;
    if (secondsRemaining <= 0) {
      clearInterval(resendTimer);
      timerLabel.style.display = 'none';
      resendBtn.style.display = 'inline';
    }
  }, 1000);
}

function getOtpCode() {
  const digits = document.querySelectorAll('.otp-digit');
  let code = '';
  digits.forEach(d => code += d.value);
  return code;
}

function clearOtpInputs() {
  const digits = document.querySelectorAll('.otp-digit');
  digits.forEach(d => d.value = '');
  if (digits[0]) digits[0].focus();
}

// ----------------------------------------------------
// BOTTOM SHEET DRAWER & MODAL MANAGEMENT
// ----------------------------------------------------
function openSheet(sheetId) {
  const overlay = document.getElementById('bottomSheetOverlay');
  const sheet = document.getElementById(sheetId);
  
  if (overlay && sheet) {
    overlay.classList.add('active');
    sheet.classList.add('active');
  }
}

function closeSheet(sheetId) {
  const overlay = document.getElementById('bottomSheetOverlay');
  const sheet = document.getElementById(sheetId);
  
  if (overlay && sheet) {
    sheet.classList.remove('active');
    const activeSheets = document.querySelectorAll('.bottom-sheet.active');
    if (activeSheets.length <= 1) {
      overlay.classList.remove('active');
    }
  }
}

function closeAllSheets() {
  const overlay = document.getElementById('bottomSheetOverlay');
  const sheets = document.querySelectorAll('.bottom-sheet');
  sheets.forEach(s => s.classList.remove('active'));
  if (overlay) overlay.classList.remove('active');
}

function initBottomSheetEvents() {
  const overlay = document.getElementById('bottomSheetOverlay');
  overlay.addEventListener('click', closeAllSheets);
  
  const closeButtons = document.querySelectorAll('.sheet-close');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const sheet = btn.closest('.bottom-sheet');
      if (sheet) closeSheet(sheet.id);
    });
  });

  // Action Cards opens sheets
  document.getElementById('btnActionAddWork').addEventListener('click', () => {
    if (state.machines.length === 0) {
      showToast("Please register a machine first!", "info");
      openSheet('sheetAddMachine');
      return;
    }
    populateMachineDropdowns();
    openSheet('sheetAddWork');
  });

  document.getElementById('btnActionReceivePayment').addEventListener('click', () => {
    populatePendingPaymentsDropdown();
    openSheet('sheetAddPayment');
  });

  document.getElementById('btnActionAddExpense').addEventListener('click', () => {
    populateMachineDropdowns();
    openSheet('sheetAddExpense');
  });

  document.getElementById('btnActionAddMachine').addEventListener('click', () => {
    openSheet('sheetAddMachine');
  });
  
  // Floating Action Buttons (FABs)
  document.getElementById('fabAddWork').addEventListener('click', () => {
    if (state.machines.length === 0) {
      showToast("Please register a machine first!", "info");
      openSheet('sheetAddMachine');
      return;
    }
    populateMachineDropdowns();
    openSheet('sheetAddWork');
  });

  document.getElementById('fabAddPayment').addEventListener('click', () => {
    populatePendingPaymentsDropdown();
    openSheet('sheetAddPayment');
  });

  document.getElementById('fabAddMachine').addEventListener('click', () => {
    openSheet('sheetAddMachine');
  });
  
  // Close Edit Machine Sheet specifically
  document.getElementById('btnCloseEditMachine').addEventListener('click', () => {
    closeSheet('sheetEditMachine');
  });
}

// ----------------------------------------------------
// FORMS INPUTS & SUBMIT ACTIONS
// ----------------------------------------------------
function initFormCalculations() {
  const inputQuantity = document.getElementById('workQuantity');
  const inputRate = document.getElementById('workRate');
  const displayTotal = document.getElementById('workTotalDisplay');
  const billingTypeSelect = document.getElementById('workBillingType');

  const updateCalculatedTotal = () => {
    const qty = parseFloat(inputQuantity.value) || 0;
    const rate = parseFloat(inputRate.value) || 0;
    const total = Math.round(qty * rate);
    displayTotal.textContent = `₹${total.toLocaleString('en-IN')}`;
  };

  inputQuantity.addEventListener('input', updateCalculatedTotal);
  inputRate.addEventListener('input', updateCalculatedTotal);
  
  billingTypeSelect.addEventListener('change', () => {
    updateBillingTypeUI();
    updateCalculatedTotal();
  });
  
  // Set initial billing type UI state
  updateBillingTypeUI();
  
  // Show/Hide custom machine input
  const machinePreset = document.getElementById('machinePreset');
  const customMachineGroup = document.getElementById('customMachineGroup');
  const customMachineName = document.getElementById('customMachineName');
  
  machinePreset.addEventListener('change', () => {
    if (machinePreset.value === 'Custom') {
      customMachineGroup.style.display = 'flex';
      customMachineName.setAttribute('required', 'true');
    } else {
      customMachineGroup.style.display = 'none';
      customMachineName.removeAttribute('required');
    }
  });

  // Link payment dropdown updates customer name and amount
  const linkSelect = document.getElementById('paymentLinkOption');
  const payCustomerInput = document.getElementById('paymentCustomerName');
  const payAmountInput = document.getElementById('paymentAmount');
  
  linkSelect.addEventListener('change', () => {
    const val = linkSelect.value;
    if (val !== 'custom') {
      const entry = state.workEntries.find(e => e.id === val);
      if (entry) {
        payCustomerInput.value = entry.customerName || '';
        payAmountInput.value = entry.total || 0;
      }
    } else {
      payCustomerInput.value = '';
      payAmountInput.value = '';
    }
  });

  // Submit forms handlers
  document.getElementById('btnSaveMachine').addEventListener('click', submitAddMachine);
  document.getElementById('btnSaveWork').addEventListener('click', submitAddWork);
  document.getElementById('btnSavePayment').addEventListener('click', submitAddPayment);
  document.getElementById('btnSaveExpense').addEventListener('click', submitAddExpense);
  document.getElementById('btnSaveEditMachine').addEventListener('click', submitEditMachine);
}

// Update form fields & labels based on selected Billing Type
function updateBillingTypeUI() {
  const billingType = document.getElementById('workBillingType').value;
  const labelQty = document.getElementById('labelWorkQuantity');
  const labelRate = document.getElementById('labelWorkRate');
  const qtyInput = document.getElementById('workQuantity');
  const presetsQty = document.getElementById('presetsWorkQuantity');
  const presetsRate = document.getElementById('presetsWorkRate');
  
  if (!labelQty || !labelRate || !qtyInput || !presetsQty || !presetsRate) return;

  if (billingType === 'hourly') {
    labelQty.textContent = "Hours Worked";
    labelRate.textContent = "Rate Per Hour";
    qtyInput.placeholder = "Hours (e.g. 8)";
    qtyInput.step = "0.1";
    presetsQty.innerHTML = `
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 4; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">4h</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 8; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">8h</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 10; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">10h</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 12; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">12h</span>
    `;
    presetsRate.innerHTML = `
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 800; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹800</span>
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 1000; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹1000</span>
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 1200; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹1200</span>
    `;
  } else if (billingType === 'load') {
    labelQty.textContent = "No. of Loads";
    labelRate.textContent = "Rate Per Load";
    qtyInput.placeholder = "Loads (e.g. 10)";
    qtyInput.step = "1";
    presetsQty.innerHTML = `
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 5; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">5 loads</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 10; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">10 loads</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 15; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">15 loads</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 20; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">20 loads</span>
    `;
    presetsRate.innerHTML = `
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 1200; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹1200</span>
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 1500; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹1500</span>
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 2000; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹2000</span>
    `;
  } else if (billingType === 'daily') {
    labelQty.textContent = "Days Rented";
    labelRate.textContent = "Rental Per Day";
    qtyInput.placeholder = "Days (e.g. 5)";
    qtyInput.step = "1";
    presetsQty.innerHTML = `
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 1; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">1 day</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 3; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">3 days</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 7; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">7 days</span>
      <span class="preset-chip" onclick="document.getElementById('workQuantity').value = 15; document.getElementById('workQuantity').dispatchEvent(new Event('input'));">15 days</span>
    `;
    presetsRate.innerHTML = `
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 4000; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹4000</span>
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 5000; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹5000</span>
      <span class="preset-chip" onclick="document.getElementById('workRate').value = 6000; document.getElementById('workRate').dispatchEvent(new Event('input'));">₹6000</span>
    `;
  }
}

// Populate Machine Dropdowns
function populateMachineDropdowns() {
  const workSelect = document.getElementById('workMachine');
  const expenseSelect = document.getElementById('expenseMachine');
  
  workSelect.innerHTML = '<option value="" disabled selected>Choose a machine...</option>';
  state.machines.forEach(m => {
    workSelect.innerHTML += `<option value="${m.id}">${m.name} (${m.regNo})</option>`;
  });
  
  expenseSelect.innerHTML = '<option value="">No machine...</option>';
  state.machines.forEach(m => {
    expenseSelect.innerHTML += `<option value="${m.id}">${m.name} (${m.regNo})</option>`;
  });
}

// Populate Pending Payments Dropdown
function populatePendingPaymentsDropdown() {
  const select = document.getElementById('paymentLinkOption');
  select.innerHTML = '<option value="custom" selected>Add Custom Payment...</option>';
  
  const pendingEntries = state.workEntries.filter(e => e.paymentStatus === 'pending');
  pendingEntries.forEach(entry => {
    const machine = state.machines.find(m => m.id === entry.machineId);
    const mName = machine ? machine.name : 'Machine';
    const dateStr = new Date(entry.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    select.innerHTML += `<option value="${entry.id}">${entry.customerName} - ₹${entry.total} (${mName}, ${dateStr})</option>`;
  });
}

// 1. ADD MACHINE SUBMIT
function submitAddMachine() {
  const preset = document.getElementById('machinePreset').value;
  const custom = document.getElementById('customMachineName').value.trim();
  const regNo = document.getElementById('machineRegNo').value.trim().toUpperCase();
  const status = document.getElementById('machineStatus').value;
  
  if (!preset) {
    showToast("Please choose a machine type", "error");
    return;
  }
  if (preset === 'Custom' && !custom) {
    showToast("Please type a machine model name", "error");
    return;
  }
  if (!regNo) {
    showToast("Please enter machine registration number", "error");
    return;
  }
  
  const name = preset === 'Custom' ? custom : preset;
  
  const newMachine = {
    id: 'm_' + Date.now(),
    name: name,
    regNo: regNo,
    status: status
  };
  
  state.machines.push(newMachine);
  saveState();
  
  // Reset Form
  document.getElementById('formAddMachine').reset();
  document.getElementById('customMachineGroup').style.display = 'none';
  
  closeSheet('sheetAddMachine');
  showToast("Machine added successfully!", "success");
  renderApp();
}

// 2. ADD WORK ENTRY SUBMIT
function submitAddWork() {
  const machineId = document.getElementById('workMachine').value;
  const customer = document.getElementById('workCustomerName').value.trim();
  const location = document.getElementById('workLocation').value.trim();
  const billingType = document.getElementById('workBillingType').value;
  const quantity = parseFloat(document.getElementById('workQuantity').value) || 0;
  const rate = parseFloat(document.getElementById('workRate').value) || 0;
  
  if (!machineId) {
    showToast("Select a machine", "error");
    return;
  }
  if (!customer) {
    showToast("Enter customer name", "error");
    return;
  }
  if (!location) {
    showToast("Enter work location", "error");
    return;
  }
  
  // Custom validations based on Billing Type
  if (quantity <= 0) {
    let unitLabel = "hours";
    if (billingType === 'load') unitLabel = "loads";
    else if (billingType === 'daily') unitLabel = "days";
    showToast(`Enter valid number of ${unitLabel}`, "error");
    return;
  }
  
  if (rate <= 0) {
    let rateLabel = "hourly rate";
    if (billingType === 'load') rateLabel = "rate per load";
    else if (billingType === 'daily') rateLabel = "daily rental rate";
    showToast(`Enter valid ${rateLabel}`, "error");
    return;
  }
  
  const total = Math.round(quantity * rate);
  const entryId = 'w_' + Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  const newWork = {
    id: entryId,
    machineId: machineId,
    customerName: customer,
    location: location,
    billingType: billingType,
    hours: quantity, // quantity mapped to hours field to preserve total calculations
    rate: rate,
    total: total,
    date: today,
    paymentStatus: 'pending'
  };
  
  state.workEntries.unshift(newWork);
  
  // Automatically create pending payment record
  const newPayment = {
    id: 'p_' + Date.now(),
    workEntryId: entryId,
    customer: customer,
    amount: total,
    status: 'pending',
    date: today
  };
  state.payments.unshift(newPayment);
  
  saveState();
  
  // Reset Form
  document.getElementById('formAddWork').reset();
  document.getElementById('workBillingType').value = 'hourly';
  updateBillingTypeUI();
  document.getElementById('workTotalDisplay').textContent = '₹0';
  
  closeSheet('sheetAddWork');
  showToast("Work entry saved!", "success");
  renderApp();
}

// 3. RECORD PAYMENT SUBMIT
function submitAddPayment() {
  const linkId = document.getElementById('paymentLinkOption').value;
  const customer = document.getElementById('paymentCustomerName').value.trim();
  const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const status = document.getElementById('paymentStatus').value;
  
  if (!customer) {
    showToast("Enter customer name", "error");
    return;
  }
  if (amount <= 0) {
    showToast("Enter payment amount", "error");
    return;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  if (linkId !== 'custom') {
    // Update linked work entry status
    const workEntryIndex = state.workEntries.findIndex(w => w.id === linkId);
    if (workEntryIndex !== -1) {
      state.workEntries[workEntryIndex].paymentStatus = status;
    }
    
    // Update payment record
    const paymentIndex = state.payments.findIndex(p => p.workEntryId === linkId);
    if (paymentIndex !== -1) {
      state.payments[paymentIndex].status = status;
      state.payments[paymentIndex].amount = amount;
      state.payments[paymentIndex].date = today;
    }
  } else {
    // Independent payment record
    const newPayment = {
      id: 'p_' + Date.now(),
      workEntryId: null,
      customer: customer,
      amount: amount,
      status: status,
      date: today
    };
    state.payments.unshift(newPayment);
  }
  
  saveState();
  
  document.getElementById('formAddPayment').reset();
  closeSheet('sheetAddPayment');
  showToast("Payment recorded!", "success");
  renderApp();
}

// 4. ADD EXPENSE SUBMIT
function submitAddExpense() {
  const category = document.getElementById('expenseCategory').value;
  const machineId = document.getElementById('expenseMachine').value;
  const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
  const note = document.getElementById('expenseNote').value.trim();
  
  if (!category) {
    showToast("Select expense category", "error");
    return;
  }
  if (amount <= 0) {
    showToast("Enter expense amount", "error");
    return;
  }
  if (!note) {
    showToast("Enter a note describing the expense", "error");
    return;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  const newExpense = {
    id: 'e_' + Date.now(),
    category: category,
    machineId: machineId || null,
    amount: amount,
    note: note,
    date: today
  };
  
  state.expenses.unshift(newExpense);
  saveState();
  
  document.getElementById('formAddExpense').reset();
  closeSheet('sheetAddExpense');
  showToast("Expense entry saved!", "success");
  renderApp();
}

// ----------------------------------------------------
// EDIT / DELETE MACHINE ACTIONS (GLOBAL HANDLERS)
// ----------------------------------------------------
window.openEditMachineSheet = function(machineId) {
  const machine = state.machines.find(m => m.id === machineId);
  if (!machine) return;
  
  document.getElementById('editMachineId').value = machine.id;
  document.getElementById('editMachineName').value = machine.name;
  document.getElementById('editMachineRegNo').value = machine.regNo;
  document.getElementById('editMachineStatus').value = machine.status;
  
  openSheet('sheetEditMachine');
};

function submitEditMachine() {
  const machineId = document.getElementById('editMachineId').value;
  const name = document.getElementById('editMachineName').value.trim();
  const regNo = document.getElementById('editMachineRegNo').value.trim().toUpperCase();
  const status = document.getElementById('editMachineStatus').value;
  
  if (!name || !regNo) {
    showToast("Name and Registration Number are required", "error");
    return;
  }
  
  const index = state.machines.findIndex(m => m.id === machineId);
  if (index !== -1) {
    state.machines[index].name = name;
    state.machines[index].regNo = regNo;
    state.machines[index].status = status;
    
    saveState();
    closeSheet('sheetEditMachine');
    showToast("Machine details updated!", "success");
    renderApp();
  }
}

window.deleteMachine = function(machineId) {
  const machine = state.machines.find(m => m.id === machineId);
  if (!machine) return;
  
  const confirmMsg = `Are you sure you want to delete "${machine.name} (${machine.regNo})"?\n\nWARNING: This will permanently delete the machine and all its associated work log entries and pending payments.`;
  
  if (confirm(confirmMsg)) {
    // 1. Filter out the machine
    state.machines = state.machines.filter(m => m.id !== machineId);
    
    // 2. Find linked work entry IDs to clean up payments
    const linkedWorkIds = state.workEntries
      .filter(w => w.machineId === machineId)
      .map(w => w.id);
      
    // 3. Remove linked work entries
    state.workEntries = state.workEntries.filter(w => w.machineId !== machineId);
    
    // 4. Remove linked payments
    state.payments = state.payments.filter(p => !linkedWorkIds.includes(p.workEntryId));
    
    // 5. Remove linked expenses
    state.expenses = state.expenses.filter(e => e.machineId !== machineId);
    
    saveState();
    showToast("Machine and linked operations deleted", "info");
    renderApp();
  }
};

// ----------------------------------------------------
// DATA RENDERING & CALCULATIONS
// ----------------------------------------------------
function renderApp() {
  if (!state.user || !state.userName) return;
  
  // Set personalized greeting in header
  const headerGreeting = document.getElementById('headerGreeting');
  if (headerGreeting) {
    headerGreeting.textContent = `Hello, ${state.userName}!`;
  }
  
  // Set personalized details in profile screen
  document.getElementById('profileDisplayName').textContent = state.userName;
  document.getElementById('profilePhoneNumber').textContent = state.user;
  
  const bizEl = document.getElementById('profileBusinessName');
  if (state.businessName) {
    bizEl.style.display = 'block';
    bizEl.textContent = state.businessName;
  } else {
    bizEl.style.display = 'none';
  }
  
  // Profile initials icon (e.g. Ramesh Patel -> RP)
  const initialsEl = document.getElementById('profileInitials');
  if (initialsEl) {
    const parts = state.userName.split(' ');
    let init = parts[0][0] || '';
    if (parts.length > 1 && parts[parts.length-1][0]) {
      init += parts[parts.length-1][0];
    }
    initialsEl.textContent = init.toUpperCase();
  }
  
  calculateProfitAndRender();
  renderHomeRecentWork();
  renderWorkScreenList();
  renderPaymentsScreenList();
  renderMachinesScreenList();
}

function calculateProfitAndRender() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // 1. Today's Hours & Today's Earnings
  let todayHours = 0;
  let todayEarnings = 0;
  
  state.workEntries.forEach(entry => {
    if (entry.date === todayStr) {
      if (!entry.billingType || entry.billingType === 'hourly') {
        todayHours += entry.hours;
      }
      todayEarnings += entry.total;
    }
  });
  
  document.getElementById('dashTodayHours').textContent = `${todayHours} hrs`;
  document.getElementById('dashTodayEarnings').textContent = `₹${todayEarnings.toLocaleString('en-IN')}`;
  
  // 2. Pending Payments (Total unpaid customer payments)
  let totalPending = 0;
  state.payments.forEach(p => {
    if (p.status === 'pending') {
      totalPending += p.amount;
    }
  });
  document.getElementById('dashPendingPayments').textContent = `₹${totalPending.toLocaleString('en-IN')}`;
  
  // 3. Profit calculations
  // Total Payments Received (Income)
  let totalPaymentsReceived = 0;
  state.payments.forEach(p => {
    if (p.status === 'paid') {
      totalPaymentsReceived += p.amount;
    }
  });
  
  // Total Expenses
  let totalFuel = 0;
  let totalMaintenance = 0;
  let totalOther = 0;
  
  state.expenses.forEach(e => {
    if (e.category === 'fuel') totalFuel += e.amount;
    else if (e.category === 'maintenance') totalMaintenance += e.amount;
    else totalOther += e.amount;
  });
  
  const totalExpenses = totalFuel + totalMaintenance + totalOther;
  const monthlyProfit = totalPaymentsReceived - totalExpenses;
  
  document.getElementById('dashMonthlyProfit').textContent = `₹${monthlyProfit.toLocaleString('en-IN')}`;
  document.getElementById('dashTotalPayments').textContent = `₹${totalPaymentsReceived.toLocaleString('en-IN')}`;
  document.getElementById('dashTotalExpenses').textContent = `₹${totalExpenses.toLocaleString('en-IN')}`;
}

// Render Recent Work Log Preview on Dashboard
function renderHomeRecentWork() {
  const container = document.getElementById('homeRecentWorkList');
  container.innerHTML = '';
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = state.workEntries.filter(e => e.date === todayStr);
  
  if (todayEntries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-file-list-3-line"></i>
        <p>No work logged today. Click "Add Work" to begin.</p>
      </div>
    `;
    return;
  }
  
  todayEntries.slice(0, 3).forEach(entry => {
    const machine = state.machines.find(m => m.id === entry.machineId);
    const mName = machine ? machine.name : 'Unknown Equipment';
    container.appendChild(createWorkCardElement(entry, mName));
  });
}

// Render Full Work Logs list
function renderWorkScreenList() {
  const container = document.getElementById('workLogsList');
  container.innerHTML = '';
  
  if (state.workEntries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-history-line"></i>
        <p>No work entries logged yet.</p>
      </div>
    `;
    return;
  }
  
  state.workEntries.forEach(entry => {
    const machine = state.machines.find(m => m.id === entry.machineId);
    const mName = machine ? machine.name : 'Unknown Equipment';
    container.appendChild(createWorkCardElement(entry, mName));
  });
}

function createWorkCardElement(entry, machineName) {
  const card = document.createElement('div');
  card.className = 'work-card';
  
  const formattedDate = new Date(entry.date).toLocaleDateString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
  
  const billingType = entry.billingType || 'hourly';
  let qtyLabel = "Hours";
  let qtyValue = `${entry.hours} hrs`;
  let rateLabel = "Rate / hr";
  let rateValue = `₹${entry.rate}/hr`;
  
  if (billingType === 'load') {
    qtyLabel = "Loads";
    qtyValue = `${entry.hours} loads`;
    rateLabel = "Rate / load";
    rateValue = `₹${entry.rate}/load`;
  } else if (billingType === 'daily') {
    qtyLabel = "Days";
    qtyValue = `${entry.hours} days`;
    rateLabel = "Rate / day";
    rateValue = `₹${entry.rate}/day`;
  }
  
  card.innerHTML = `
    <div class="work-card-header">
      <div class="work-card-title">
        <span class="work-customer">${entry.customerName}</span>
        <span class="work-date">${formattedDate}</span>
      </div>
      <span class="work-amount">₹${entry.total.toLocaleString('en-IN')}</span>
    </div>
    <div class="work-card-details">
      <div class="detail-sub-box">
        <span class="detail-sub-label">Machine</span>
        <span class="detail-sub-val">${machineName}</span>
      </div>
      <div class="detail-sub-box">
        <span class="detail-sub-label">${qtyLabel}</span>
        <span class="detail-sub-val">${qtyValue}</span>
      </div>
      <div class="detail-sub-box">
        <span class="detail-sub-label">${rateLabel}</span>
        <span class="detail-sub-val">${rateValue}</span>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:8px; margin-top:4px;">
      <span style="font-size:11px; color:var(--text-muted); font-weight:600;"><i class="ri-map-pin-line"></i> ${entry.location}</span>
      <span class="payment-status ${entry.paymentStatus}" style="font-size:9px; font-weight:700; padding:2px 8px; border-radius:var(--radius-full); text-transform:uppercase;">
        ${entry.paymentStatus}
      </span>
    </div>
  `;
  return card;
}

// Render Payments list
let paymentFilter = 'all';

function renderPaymentsScreenList() {
  const container = document.getElementById('paymentsList');
  container.innerHTML = '';
  
  const filterButtons = document.querySelectorAll('.segment-control .segment-btn');
  filterButtons.forEach(btn => {
    btn.removeEventListener('click', handlePaymentFilterClick);
    btn.addEventListener('click', handlePaymentFilterClick);
  });
  
  let filteredPayments = state.payments;
  if (paymentFilter !== 'all') {
    filteredPayments = state.payments.filter(p => p.status === paymentFilter);
  }
  
  if (filteredPayments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-hand-coin-line"></i>
        <p>No ${paymentFilter !== 'all' ? paymentFilter : ''} payments recorded yet.</p>
      </div>
    `;
    return;
  }
  
  filteredPayments.forEach(p => {
    const card = document.createElement('div');
    card.className = 'payment-card';
    
    card.addEventListener('click', () => {
      togglePaymentStatus(p.id);
    });
    
    const dateStr = new Date(p.date).toLocaleDateString('en-IN', {
      month: 'short', day: 'numeric'
    });
    
    card.innerHTML = `
      <div class="payment-info">
        <span class="payment-customer">${p.customer}</span>
        <span class="payment-date">${dateStr}</span>
      </div>
      <div class="payment-amount-badge" style="display:flex; flex-direction:column; align-items:flex-end;">
        <span class="payment-amount">₹${p.amount.toLocaleString('en-IN')}</span>
        <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
          <span class="payment-status ${p.status}">${p.status}</span>
          <button class="btn btn-outline btn-sm btn-print" onclick="window.generateInvoice('${p.id}'); event.stopPropagation();" style="padding: 4px 8px; font-size:11px; height:auto; min-height:0; display:inline-flex; align-items:center; gap:3px; margin:0; border-radius:6px; font-weight:700; width:auto;"><i class="ri-printer-line" style="font-size:11px; margin:0;"></i> Bill</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function handlePaymentFilterClick(e) {
  const btn = e.target;
  const filter = btn.getAttribute('data-filter');
  
  document.querySelectorAll('.segment-control .segment-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  paymentFilter = filter;
  renderPaymentsScreenList();
}

function togglePaymentStatus(paymentId) {
  const paymentIndex = state.payments.findIndex(p => p.id === paymentId);
  if (paymentIndex === -1) return;
  
  const payment = state.payments[paymentIndex];
  const newStatus = payment.status === 'paid' ? 'pending' : 'paid';
  
  state.payments[paymentIndex].status = newStatus;
  
  if (payment.workEntryId) {
    const workIndex = state.workEntries.findIndex(w => w.id === payment.workEntryId);
    if (workIndex !== -1) {
      state.workEntries[workIndex].paymentStatus = newStatus;
    }
  }
  
  saveState();
  showToast(`Payment marked as ${newStatus.toUpperCase()}`, "success");
  renderApp();
}

// Render Machines list
function renderMachinesScreenList() {
  const container = document.getElementById('machinesList');
  container.innerHTML = '';
  
  if (state.machines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ri-car-line"></i>
        <p>No machines added yet. Add a machine to start logging work.</p>
      </div>
    `;
    return;
  }
  
  state.machines.forEach(m => {
    const card = document.createElement('div');
    card.className = 'machine-card';
    
    let statusLabel = 'Working';
    if (m.status === 'idle') statusLabel = 'Available';
    else if (m.status === 'maintenance') statusLabel = 'Maintenance';
    
    card.innerHTML = `
      <div class="machine-info">
        <span class="machine-name">${m.name}</span>
        <span class="machine-reg">${m.regNo}</span>
      </div>
      <div class="machine-status-row">
        <span class="machine-status-badge ${m.status}">${statusLabel}</span>
        <div class="machine-actions">
          <button class="btn-machine-action edit" onclick="window.openEditMachineSheet('${m.id}')" title="Edit Machine"><i class="ri-edit-line"></i></button>
          <button class="btn-machine-action delete" onclick="window.deleteMachine('${m.id}')" title="Delete Machine"><i class="ri-delete-bin-line"></i></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ----------------------------------------------------
// PROFILE & SETTINGS ACTIONS
// ----------------------------------------------------
function initProfileEvents() {
  const btnToggleConfig = document.getElementById('btnToggleFirebaseSettings');
  const fbContent = document.getElementById('firebaseSettingsContent');
  const fbArrow = document.getElementById('firebaseConfigArrow');
  
  btnToggleConfig.addEventListener('click', () => {
    const isActive = fbContent.classList.contains('active');
    if (isActive) {
      fbContent.classList.remove('active');
      fbArrow.style.transform = 'rotate(0deg)';
    } else {
      fbContent.classList.add('active');
      fbArrow.style.transform = 'rotate(180deg)';
    }
  });
  
  // Save Firebase configuration
  document.getElementById('btnSaveFirebaseConfig').addEventListener('click', () => {
    const apiKey = document.getElementById('fbApiKey').value.trim();
    const authDomain = document.getElementById('fbAuthDomain').value.trim();
    const projectId = document.getElementById('fbProjectId').value.trim();
    const appId = document.getElementById('fbAppId').value.trim();
    
    if (!apiKey || !authDomain || !projectId || !appId) {
      showToast("Please fill all configuration details", "error");
      return;
    }
    
    const config = {
      apiKey: apiKey,
      authDomain: authDomain,
      projectId: projectId,
      appId: appId
    };
    
    localStorage.setItem('mm_firebase_config', JSON.stringify(config));
    showToast("Firebase Config saved! Reloading app...", "success");
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });
  
  // Delete all application data
  document.getElementById('btnResetAppData').addEventListener('click', () => {
    if (confirm("Are you sure you want to delete ALL logged work entries, payments, machines and expense logs? This cannot be undone.")) {
      localStorage.removeItem('mm_app_state');
      localStorage.removeItem('mm_firebase_config');
      showToast("All data cleared successfully! Reloading...", "info");
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  });
  
  // Log Out button
  document.getElementById('btnLogOut').addEventListener('click', () => {
    if (confirm("Do you want to log out?")) {
      showLoading(true);
      
      const doLogout = () => {
        state.user = null;
        state.userName = '';
        state.businessName = '';
        saveState();
        
        showLoading(false);
        // Display auth screen and reset states
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('authOtpStep').style.display = 'none';
        document.getElementById('authOnboardingStep').style.display = 'none';
        document.getElementById('authPhoneStep').style.display = 'flex';
        document.getElementById('loginPhoneNumber').value = '';
        document.getElementById('onboardingName').value = '';
        document.getElementById('onboardingBusiness').value = '';
        clearOtpInputs();
        showToast("Logged out successfully", "info");
      };
      
      if (!isMockAuth && firebaseAuth) {
        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
          .then(({ signOut }) => {
            signOut(firebaseAuth).then(doLogout).catch(e => {
              console.error(e);
              doLogout();
            });
          });
      } else {
        setTimeout(doLogout, 600);
      }
    }
  });
}

// ----------------------------------------------------
// UTILITY CHANNELS (TOAST & SPINNERS)
// ----------------------------------------------------
function showToast(message, type = 'info') {
  const toast = document.getElementById('toastBanner');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  
  if (!toast) return;
  
  toast.className = `toast-banner ${type}`;
  toastMsg.textContent = message;
  
  if (type === 'success') toastIcon.className = 'ri-checkbox-circle-line';
  else if (type === 'error') toastIcon.className = 'ri-error-warning-line';
  else if (type === 'info') toastIcon.className = 'ri-information-line';
  
  toast.style.display = 'flex';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    if (show) overlay.classList.add('active');
    else overlay.classList.remove('active');
  }
}

// ----------------------------------------------------
// INVOICE BILLING & PRINT ENGINE
// ----------------------------------------------------
function initInvoiceEvents() {
  const btnClose = document.getElementById('btnCloseInvoice');
  const btnDismiss = document.getElementById('btnDismissInvoice');
  const btnPrint = document.getElementById('btnPrintInvoice');
  const btnDownload = document.getElementById('btnDownloadPDF');
  
  if (btnClose) btnClose.addEventListener('click', () => closeSheet('invoiceModal'));
  if (btnDismiss) btnDismiss.addEventListener('click', () => closeSheet('invoiceModal'));
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      const element = document.getElementById('invoicePrintArea');
      if (!element) return;
      
      showLoading(true);
      
      // Generate filename based on date
      const dateSuffix = new Date().toISOString().split('T')[0];
      const filename = `Invoice_${dateSuffix}.pdf`;
      
      const opt = {
        margin:       10,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // Call html2pdf.js library
      html2pdf().set(opt).from(element).save().then(() => {
        showLoading(false);
        showToast("PDF Invoice Downloaded!", "success");
      }).catch(err => {
        showLoading(false);
        showToast("Failed to generate PDF: " + err.message, "error");
        console.error(err);
      });
    });
  }
}

window.generateInvoice = function(paymentId) {
  const payment = state.payments.find(p => p.id === paymentId);
  if (!payment) return;
  
  // Find linked work entry (if any)
  const entry = state.workEntries.find(w => w.id === payment.workEntryId);
  const machine = entry ? state.machines.find(m => m.id === entry.machineId) : null;
  const machineName = machine ? machine.name : 'Heavy Equipment';
  const regNo = machine ? machine.regNo : '';
  
  const printArea = document.getElementById('invoicePrintArea');
  if (!printArea) return;
  
  const invNumber = 'INV-' + payment.id.split('_')[1];
  const invDate = new Date(payment.date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  
  // Description and subtotal based on billing type
  let qtyText = '-';
  let rateText = '-';
  let desc = `Charges for ${machineName} (${regNo})`;
  
  if (entry) {
    const billingType = entry.billingType || 'hourly';
    if (billingType === 'hourly') {
      qtyText = `${entry.hours} hrs`;
      rateText = `₹${entry.rate}/hr`;
      desc = `Equipment Rental - ${machineName} (${regNo}) - Hourly Charges`;
    } else if (billingType === 'load') {
      qtyText = `${entry.hours} loads`;
      rateText = `₹${entry.rate}/load`;
      desc = `Equipment Rental - ${machineName} (${regNo}) - Loader/Trips Charges`;
    } else if (billingType === 'daily') {
      qtyText = `${entry.hours} days`;
      rateText = `₹${entry.rate}/day`;
      desc = `Equipment Rental - ${machineName} (${regNo}) - Daily Rental Charges`;
    }
  } else {
    qtyText = '1';
    rateText = `₹${payment.amount}`;
    desc = `Custom service charges`;
  }
  
  // Build Invoice HTML
  printArea.innerHTML = `
    <div class="invoice-header">
      <div class="invoice-brand">
        <i class="ri-truck-line"></i>
        <span>MachineMitra</span>
      </div>
      <div class="invoice-meta">
        <h2>INVOICE</h2>
        <p><strong>Invoice No:</strong> ${invNumber}</p>
        <p><strong>Date:</strong> ${invDate}</p>
      </div>
    </div>
    
    <div class="invoice-addresses">
      <div class="address-col">
        <h4>From:</h4>
        <p class="owner-name">${state.userName}</p>
        <p class="biz-name">${state.businessName || 'Construction Services'}</p>
        <p class="phone-no">Phone: ${state.user}</p>
      </div>
      <div class="address-col">
        <h4>Bill To:</h4>
        <p class="client-name">${payment.customer}</p>
        <p class="location-details">${entry ? 'Location: ' + entry.location : ''}</p>
      </div>
    </div>
    
    <table class="invoice-table">
      <thead>
        <tr>
          <th style="text-align: left;">Description</th>
          <th style="text-align: center;">Rate</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${desc}</td>
          <td style="text-align: center;">${rateText}</td>
          <td style="text-align: center;">${qtyText}</td>
          <td style="text-align: right; font-weight: 600;">₹${payment.amount.toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="invoice-totals">
      <div class="totals-row">
        <span>Subtotal:</span>
        <span>₹${payment.amount.toLocaleString('en-IN')}</span>
      </div>
      <div class="totals-row grand-total">
        <span>Grand Total:</span>
        <span>₹${payment.amount.toLocaleString('en-IN')}</span>
      </div>
    </div>
    
    <div class="invoice-footer">
      <p>Thank you for your business!</p>
      <p class="tagline">Generated via MachineMitra - Track machines. Track money.</p>
    </div>
  `;
  
  openSheet('invoiceModal');
};
