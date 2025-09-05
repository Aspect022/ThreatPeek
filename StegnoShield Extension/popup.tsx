import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Upload,
  FileText,
  Copy,
  CheckCircle,
  AlertCircle,
  X,
  Image as ImageIcon,
  Clock,
  Trash2,
} from "lucide-react";
import { ocrService, type OCRResult } from "~utils/ocr";
import { storage, type StoredOCRResult } from "~utils/storage";

export default function Popup() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [settings, setSettings] = useState({
    ocrLang: "en",
    ocrMode: "local" as const,
  });
  const [lastResult, setLastResult] = useState<StoredOCRResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load settings and last OCR result on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load settings
        const storedSettings = await storage.get();
        setSettings({
          ocrLang: storedSettings.ocrLang,
          ocrMode: storedSettings.ocrMode,
        });

        // Load last OCR result
        const lastOCR = await storage.getLastOCRResult();
        if (lastOCR) {
          setLastResult(lastOCR);
          setResult(lastOCR.result);
        }
      } catch (error) {
        console.warn("Failed to load initial data:", error);
      }
    };

    loadInitialData();
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, GIF)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      setError("Image size must be less than 10MB");
      return;
    }

    setImageFile(file);
    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) handleImageUpload(file);
    },
    [handleImageUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) handleImageUpload(file);
    },
    [handleImageUpload]
  );

  const runOCR = useCallback(async () => {
    if (!imageFile) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      // Initialize OCR service with user's language preference
      const language = settings.ocrLang === "en" ? "eng" : settings.ocrLang;
      await ocrService.initialize(language);
      setProgress(20);

      // Create temporary image element for processing
      const img = new Image();
      img.onload = async () => {
        try {
          setProgress(40);

          // Extract text with progress updates
          const ocrResult = await ocrService.extractText(img, (progress) => {
            setProgress(40 + progress * 0.6); // 40% to 100%
          });

          setResult(ocrResult);
          setProgress(100);

          // Save result to storage
          try {
            await storage.saveOCRResult(ocrResult, imageFile);
          } catch (error) {
            console.warn("Failed to save OCR result:", error);
          }
        } catch (err) {
          setError(
            "Failed to extract text from image. Please try a clearer image."
          );
        } finally {
          setIsProcessing(false);
          setProgress(0);
        }
      };
      img.src = imagePreview!;
    } catch (err) {
      setError(
        "Failed to initialize OCR service. Please refresh and try again."
      );
      setIsProcessing(false);
      setProgress(0);
    }
  }, [imageFile, imagePreview, settings.ocrLang]);

  const copyToClipboard = useCallback(async () => {
    if (!result?.text) return;

    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError("Failed to copy to clipboard");
    }
  }, [result]);

  const resetState = useCallback(() => {
    setImagePreview(null);
    setImageFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setIsProcessing(false);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await storage.clearOCRHistory();
      setLastResult(null);
      setResult(null);
    } catch (error) {
      console.warn("Failed to clear history:", error);
    }
  }, []);

  const restoreLastResult = useCallback(() => {
    if (lastResult) {
      setResult(lastResult.result);
      setImageFile(null);
      setImagePreview(null);
    }
  }, [lastResult]);

  return (
    <div className="w-[380px] min-h-[500px] bg-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">StegoShield</h1>
          <p className="text-sm text-gray-600">
            Extract hidden text from images
          </p>
        </div>
      </motion.div>

      <div className="p-4 space-y-4">
        {/* Last Result Quick Access */}
        <AnimatePresence>
          {lastResult && !result && !imageFile && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Last Analysis
                </h3>
                <button
                  onClick={clearHistory}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {lastResult.imageName} •{" "}
                {new Date(lastResult.timestamp).toLocaleDateString()}
              </p>
              <div className="bg-white border border-blue-200 rounded-lg p-3 mb-3 max-h-20 overflow-y-auto">
                <p className="text-xs text-gray-800 line-clamp-3">
                  {lastResult.result.text || "No text detected"}
                </p>
              </div>
              <button
                onClick={restoreLastResult}
                className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                View Full Result
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Upload Area */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Upload Image
          </label>

          <AnimatePresence mode="wait">
            {!imagePreview ? (
              <motion.div
                key="upload-zone"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
                  ${
                    isDragOver
                      ? "border-blue-400 bg-blue-50 scale-105"
                      : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                  }
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />

                <motion.div
                  initial={{ y: 10 }}
                  animate={{ y: 0 }}
                  className="space-y-3"
                >
                  <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-gray-700">
                      {isDragOver
                        ? "Drop image here"
                        : "Click to upload or drag & drop"}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      PNG, JPG, GIF up to 10MB
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="image-preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group"
              >
                <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

                  {/* Remove button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={resetState}
                    className="absolute top-3 right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OCR Button */}
        {imageFile && !isProcessing && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={runOCR}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
          >
            <FileText className="w-5 h-5" />
            Analyze Image with OCR
            {settings.ocrMode === "cloud" && (
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                Cloud
              </span>
            )}
          </motion.button>
        )}

        {/* Progress Section */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  Processing image...
                </span>
                <span className="text-blue-600 font-semibold">
                  {Math.round(progress)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>
                  Extracting text with Tesseract.js ({settings.ocrLang})...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Text Extracted Successfully
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
                      Confidence: {Math.round(result.confidence * 100)}%
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Text
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                <div className="bg-white border border-green-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {result.text ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed"
                    >
                      {result.text}
                    </motion.p>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>No readable text detected in this image</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={runOCR}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Analyze Again
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetState}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  New Image
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        <AnimatePresence>
          {!imageFile && !result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="text-center py-12 text-gray-500"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                Ready to Extract Text
              </h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                Upload an image to extract hidden or readable text using
                advanced OCR technology
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
