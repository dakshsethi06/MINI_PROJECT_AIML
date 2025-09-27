import QRReader from './vendor/qrscan.js';
import { snackbar } from './snackbar.js';
import styles from '../css/styles.css';
import isURL from 'is-url';

//If service worker is installed, show offline usage notification
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(reg => {
        console.log('SW registered: ', reg);
        if (!localStorage.getItem('offline')) {
          localStorage.setItem('offline', true);
          showSnackbar('App is ready for offline usage.', 5000);
        }
      })
      .catch(regError => {
        console.log('SW registration failed: ', regError);
      });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  //To check the device and add iOS support
  window.iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;
  window.isMediaStreamAPISupported = navigator && navigator.mediaDevices && 'enumerateDevices' in navigator.mediaDevices;
  window.noCameraPermission = false;

  // Add scroll effect to navigation
  let lastScrollY = window.scrollY;
  const nav = document.querySelector('.apple-nav');

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    if (currentScrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }

    lastScrollY = currentScrollY;
  });

  var copiedText = null;
  var frame = null;
  var selectPhotoBtn = document.querySelector('#uploadButton');
  var uploadCard = document.querySelector('#uploadCard');
  var dragDropZone = document.querySelector('#dragDropZone');
  var dialogElement = document.querySelector('#resultDialog');
  var dialogOpenBtnElement = document.querySelector('#openLink');
  var dialogCloseBtnElement = document.querySelector('#closeDialog');
  var copyButton = document.querySelector('#copyButton');
  var scanningEle = document.querySelector('.scanner-line');
  var textBoxEle = document.querySelector('#result');
  var videoElement = document.querySelector('.scanner-video');
  var fileInput = document.querySelector('#fileInput');
  var snackbarElement = document.querySelector('#snackbar');
  var autoRedirectIndicator = document.querySelector('#autoRedirectIndicator');

  // Settings elements
  var settingsToggle = document.querySelector('#settingsToggle');
  var settingsPanel = document.querySelector('#settingsPanel');
  var settingsClose = document.querySelector('#closeSettings');
  var autoRedirectToggle = document.querySelector('#autoRedirectToggle');
  var confirmRedirectToggle = document.querySelector('#confirmRedirectToggle');

  // Settings state
  var settings = {
    autoRedirect: localStorage.getItem('autoRedirect') === 'true' || true, // Enable by default
    confirmRedirect: localStorage.getItem('confirmRedirect') === 'true' || false // Disable confirmation by default
  };

  // Initialize settings
  function initializeSettings() {
    autoRedirectToggle.checked = settings.autoRedirect;
    confirmRedirectToggle.checked = settings.confirmRedirect;
    updateAutoRedirectIndicator();
  }

  // Update auto-redirect indicator visibility
  function updateAutoRedirectIndicator() {
    if (autoRedirectIndicator) {
      if (settings.autoRedirect) {
        autoRedirectIndicator.classList.remove('hidden');
      } else {
        autoRedirectIndicator.classList.add('hidden');
      }
    }
  }

  // Settings event handlers
  settingsToggle.addEventListener('click', () => {
    triggerHapticFeedback('light');
    settingsPanel.classList.add('show');
  });

  settingsClose.addEventListener('click', () => {
    triggerHapticFeedback('light');
    settingsPanel.classList.remove('show');
  });

  autoRedirectToggle.addEventListener('change', e => {
    settings.autoRedirect = e.target.checked;
    localStorage.setItem('autoRedirect', settings.autoRedirect);
    updateAutoRedirectIndicator();
    triggerHapticFeedback('light');
  });

  confirmRedirectToggle.addEventListener('change', e => {
    settings.confirmRedirect = e.target.checked;
    localStorage.setItem('confirmRedirect', settings.confirmRedirect);
    triggerHapticFeedback('light');
  });

  // Close settings panel when clicking outside
  settingsPanel.addEventListener('click', e => {
    if (e.target === settingsPanel) {
      settingsPanel.classList.remove('show');
    }
  });

  // Haptic feedback simulation
  function triggerHapticFeedback(type = 'light') {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate([10, 10, 10]);
          break;
        case 'success':
          navigator.vibrate([10, 5, 10]);
          break;
        case 'error':
          navigator.vibrate([50, 25, 50]);
          break;
      }
    }
  }

  // Snackbar function
  function showSnackbar(message, duration = 3000) {
    snackbarElement.textContent = message;
    snackbarElement.classList.add('show');
    setTimeout(() => {
      snackbarElement.classList.remove('show');
    }, duration);
  }

  // Add loading state to scanner
  function showScannerLoading() {
    const scannerFrame = document.querySelector('.scanner-frame');
    const loadingElement = document.createElement('div');
    loadingElement.className = 'scanner-loading';
    loadingElement.id = 'scannerLoading';
    scannerFrame.appendChild(loadingElement);
  }

  function hideScannerLoading() {
    const loadingElement = document.getElementById('scannerLoading');
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  // Add success animation
  function showSuccessAnimation() {
    const scannerFrame = document.querySelector('.scanner-frame');
    const successElement = document.createElement('div');
    successElement.className = 'success-animation';
    successElement.id = 'successAnimation';
    scannerFrame.appendChild(successElement);

    setTimeout(() => {
      successElement.remove();
    }, 1000);
  }

  // Splash screen handling
  function hideSplashScreen() {
    const splashScreen = document.getElementById('splashScreen');
    if (splashScreen) {
      splashScreen.classList.add('hidden');
      setTimeout(() => {
        splashScreen.remove();
      }, 500);
    }
  }

  //Initializing qr scanner
  window.addEventListener('load', event => {
    QRReader.init(); //To initialize QR Scanner
    initializeSettings(); // Initialize settings UI

    // Hide splash screen after a short delay
    setTimeout(() => {
      hideSplashScreen();
    }, 2000);

    // Set camera overlay size
    setTimeout(() => {
      if (window.isMediaStreamAPISupported) {
        scan();
      }
    }, 1000);

    // To support other browsers who dont have mediaStreamAPI
    selectFromPhoto();
  });

  function createFrame() {
    frame = document.createElement('img');
    frame.src = '';
    frame.id = 'frame';
    frame.style.display = 'none';
  }

  //Dialog event handlers
  dialogCloseBtnElement.addEventListener('click', hideDialog, false);
  dialogOpenBtnElement.addEventListener('click', openInBrowser, false);
  copyButton.addEventListener('click', copyToClipboard, false);

  //To open result in browser
  function openInBrowser() {
    console.log('Result: ', copiedText);
    if (copiedText && isURL(copiedText)) {
      window.open(copiedText, '_blank', 'toolbar=0,location=0,menubar=0');
      showSnackbar('🚀 Opening website...', 2000);
    } else {
      showSnackbar('❌ Invalid URL', 2000);
    }
    copiedText = null;
    hideDialog();
  }

  // Copy to clipboard
  function copyToClipboard() {
    triggerHapticFeedback('success');

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(copiedText)
        .then(() => {
          showSnackbar('✓ Copied to clipboard!', 2000);
        })
        .catch(() => {
          // Fallback for older browsers
          textBoxEle.select();
          document.execCommand('copy');
          showSnackbar('✓ Copied to clipboard!', 2000);
        });
    } else {
      // Fallback for older browsers
      textBoxEle.select();
      document.execCommand('copy');
      showSnackbar('✓ Copied to clipboard!', 2000);
    }
  }

  // Auto-redirect function
  function handleAutoRedirect(url) {
    if (settings.autoRedirect && isURL(url)) {
      if (settings.confirmRedirect) {
        // Show confirmation dialog with better styling
        const confirmed = confirm(`🌐 QR Code URL Detected!\n\n${url}\n\nDo you want to open this website?`);
        if (confirmed) {
          triggerHapticFeedback('success');
          try {
            window.open(url, '_blank', 'toolbar=0,location=0,menubar=0');
            showSnackbar('🚀 Opening website...', 3000);
          } catch (error) {
            console.error('Error opening URL:', error);
            showSnackbar('❌ Could not open website', 3000);
          }
          return true; // Indicates redirect was handled
        }
      } else {
        // Direct redirect with countdown
        triggerHapticFeedback('success');
        showSnackbar('🌐 URL detected! Opening in 2 seconds...', 2000);

        setTimeout(() => {
          try {
            window.open(url, '_blank', 'toolbar=0,location=0,menubar=0');
            showSnackbar('🚀 Website opened!', 2000);
          } catch (error) {
            console.error('Error opening URL:', error);
            showSnackbar('❌ Could not open website', 3000);
          }
        }, 2000);

        return true; // Indicates redirect was handled
      }
    }
    return false; // No redirect handled
  }

  //Scan
  function scan(forSelectedPhotos = false) {
    const scannerFrame = document.querySelector('.scanner-frame');

    if (window.isMediaStreamAPISupported && !window.noCameraPermission) {
      scanningEle.style.display = 'block';
      scannerFrame.classList.add('scanning');
    }

    if (forSelectedPhotos) {
      scanningEle.style.display = 'block';
      scannerFrame.classList.add('scanning');
    }

    QRReader.scan(result => {
      copiedText = result;
      textBoxEle.value = result;
      textBoxEle.select();
      scanningEle.style.display = 'none';
      scannerFrame.classList.remove('scanning');

      // Trigger haptic feedback and success animation
      triggerHapticFeedback('success');
      showSuccessAnimation();

      // Check if auto-redirect should happen
      if (handleAutoRedirect(result)) {
        // If redirect was handled, continue scanning without showing dialog
        setTimeout(() => {
          scan();
        }, 1000);
        return;
      }

      // Show dialog for non-redirected results
      if (isURL(result)) {
        dialogOpenBtnElement.style.display = 'inline-block';
      } else {
        dialogOpenBtnElement.style.display = 'none';
      }
      dialogElement.classList.add('show');
      const frame = document.querySelector('#frame');
      // if (forSelectedPhotos && frame) frame.remove();
    }, forSelectedPhotos);
  }

  //Hide dialog
  function hideDialog() {
    copiedText = null;
    textBoxEle.value = '';

    if (!window.isMediaStreamAPISupported) {
      frame.src = '';
      frame.className = '';
    }

    dialogElement.classList.remove('show');
    scan();
  }

  // File handling function
  function handleFile(file) {
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      showSnackbar('Please select an image file', 3000);
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showSnackbar('File size too large. Please select an image under 10MB', 3000);
      return;
    }

    triggerHapticFeedback('light');

    // Create frame if it doesn't exist
    if (!frame) {
      createFrame();
      var pageContentElement = document.querySelector('.hero-content');
      pageContentElement.appendChild(frame);
    }

    frame.style.display = 'block';
    frame.src = URL.createObjectURL(file);
    frame.style.position = 'absolute';
    frame.style.top = '0';
    frame.style.left = '0';
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.objectFit = 'cover';
    frame.style.borderRadius = '24px';
    frame.style.zIndex = '1';

    if (!window.noCameraPermission) scanningEle.style.display = 'block';
    scan(true);
  }

  function selectFromPhoto() {
    //Creating the camera element
    createFrame();

    // Add frame to DOM
    var pageContentElement = document.querySelector('.hero-content');
    pageContentElement.appendChild(frame);

    //Click of upload button
    selectPhotoBtn.addEventListener('click', () => {
      triggerHapticFeedback('light');
      scanningEle.style.display = 'none';
      fileInput.click();
    });

    //Click of upload card
    uploadCard.addEventListener('click', () => {
      triggerHapticFeedback('light');
      scanningEle.style.display = 'none';
      fileInput.click();
    });

    //Click of drag drop zone
    dragDropZone.addEventListener('click', () => {
      triggerHapticFeedback('light');
      scanningEle.style.display = 'none';
      fileInput.click();
    });

    // Drag and drop functionality
    dragDropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dragDropZone.classList.add('drag-over');
    });

    dragDropZone.addEventListener('dragleave', e => {
      e.preventDefault();
      dragDropZone.classList.remove('drag-over');
    });

    dragDropZone.addEventListener('drop', e => {
      e.preventDefault();
      dragDropZone.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });

    //On file change
    fileInput.addEventListener('change', event => {
      if (event.target && event.target.files.length > 0) {
        handleFile(event.target.files[0]);
      }
    });
  }
});
