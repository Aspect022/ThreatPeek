import type { PlasmoCSConfig } from "plasmo";
import { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { FloatingBadge } from "~components/stegoshield/floating-badge";
import { PopoverPanel } from "~components/stegoshield/popover-panel";
import { storage } from "~utils/storage";
import { ocrService, type OCRResult } from "~utils/ocr";

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://bard.google.com/*",
  ],
};

// StegoShield component for individual images
function StegoShieldBadge({ targetImg }: { targetImg: HTMLImageElement }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState({
    ocrLang: "en",
    ocrMode: "local" as const,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load settings from storage
    storage.get().then(setSettings);
  }, []);

  const runOCR = useCallback(async () => {
    if (!targetImg) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Initialize OCR service with user's language preference
      const language = settings.ocrLang === "en" ? "eng" : settings.ocrLang;
      await ocrService.initialize(language);

      // Extract text from the image
      const ocrResult = await ocrService.extractText(targetImg);
      setResult(ocrResult);

      // Save result to storage
      try {
        // Create a mock file object for storage (since we don't have the actual file)
        const mockFile = new File([], targetImg.alt || "chat-image", {
          type: "image/jpeg",
        });
        await storage.saveOCRResult(ocrResult, mockFile);
      } catch (error) {
        console.warn("Failed to save OCR result:", error);
      }
    } catch (err) {
      setError("Failed to extract text from image");
      console.error("OCR failed:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [targetImg, settings.ocrLang]);

  const handleBadgeClick = useCallback(() => {
    setOpen(!open);
    // Auto-run OCR when opening if we don't have results yet
    if (!open && !result && !isProcessing) {
      runOCR();
    }
  }, [open, result, isProcessing, runOCR]);

  return (
    <>
      <FloatingBadge onClick={handleBadgeClick} />
      <PopoverPanel
        open={open}
        onOpenChange={setOpen}
        imageElement={targetImg}
        result={result}
        isProcessing={isProcessing}
        error={error}
        onRunOCR={runOCR}
        settings={settings}
      />
    </>
  );
}

// Function to inject StegoShield badge on a single image with Shadow DOM isolation
function injectBadge(img: HTMLImageElement) {
  // Skip if already injected or if image is too small
  if (
    img.dataset.stegoshieldInjected ||
    img.naturalWidth < 100 ||
    img.naturalHeight < 100
  ) {
    return;
  }

  // Skip images that are likely icons or decorative elements
  const src = img.src.toLowerCase();
  if (
    src.includes("icon") ||
    src.includes("avatar") ||
    src.includes("emoji") ||
    src.includes("logo") ||
    img.classList.contains("icon") ||
    img.classList.contains("avatar")
  ) {
    return;
  }

  try {
    // Mark as injected
    img.dataset.stegoshieldInjected = "true";

    // Create isolated container with Shadow DOM
    const container = document.createElement("div");
    container.id = `stegoshield-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create shadow root for complete isolation
    const shadow = container.attachShadow({ mode: "closed" });

    // Add isolated styles to prevent conflicts
    const style = document.createElement("style");
    style.textContent = `
      :host {
        position: absolute !important;
        top: 8px !important;
        right: 8px !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        isolation: isolate !important;
        contain: layout style paint !important;
        will-change: transform !important;
        transform: translateZ(0) !important;
        filter: none !important;
        backdrop-filter: none !important;
        mix-blend-mode: normal !important;
      }
      
      * {
        box-sizing: border-box !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        line-height: 1.4 !important;
        text-rendering: optimizeLegibility !important;
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
      }
      
      /* Prevent any inherited styles from affecting our UI */
      button, div, span {
        all: unset !important;
        display: revert !important;
        color: revert !important;
        background: revert !important;
        border: revert !important;
        margin: revert !important;
        padding: revert !important;
        font-size: revert !important;
        font-weight: revert !important;
        text-decoration: revert !important;
        list-style: revert !important;
        outline: revert !important;
        cursor: revert !important;
      }
    `;

    shadow.appendChild(style);

    // Ensure image has relative positioning for absolute badge positioning
    if (
      img.style.position !== "relative" &&
      img.style.position !== "absolute"
    ) {
      img.style.position = "relative";
    }

    // Insert container into the page
    img.parentElement?.appendChild(container);

    // Create React root inside shadow DOM
    const root = createRoot(shadow);
    root.render(<StegoShieldBadge targetImg={img} />);

    console.log("StegoShield badge injected for image:", img.src);
  } catch (error) {
    console.error("Failed to inject StegoShield badge for image:", error);
  }
}

// Main injection function
function injectAllBadges() {
  const images = document.querySelectorAll("img");
  images.forEach((img) => injectBadge(img as HTMLImageElement));
}

// Mutation observer to watch for new images
const observer = new MutationObserver((mutations) => {
  let shouldInject = false;

  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // Check if the added node is an image or contains images
          if (element.tagName === "IMG" || element.querySelector("img")) {
            shouldInject = true;
          }
        }
      });
    }

    // Check for attribute changes that might affect image display
    if (
      mutation.type === "attributes" &&
      mutation.attributeName === "src" &&
      mutation.target.nodeType === Node.ELEMENT_NODE
    ) {
      const target = mutation.target as Element;
      if (target.tagName === "IMG") {
        shouldInject = true;
      }
    }
  });

  if (shouldInject) {
    // Use setTimeout to avoid excessive calls
    setTimeout(injectAllBadges, 100);
  }
});

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectAllBadges();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "style", "class"],
    });
  });
} else {
  injectAllBadges();
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "style", "class"],
  });
}

// Handle page visibility changes (for SPA navigation)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    // Page became visible, re-inject if needed
    setTimeout(injectAllBadges, 500);
  }
});
