import { useState, useEffect } from "react";
import {
  Shield,
  Settings,
  Globe,
  Languages,
  Cloud,
  CheckCircle,
} from "lucide-react";
import { storage, type StegoShieldSettings } from "~utils/storage";

export default function Options() {
  const [settings, setSettings] = useState<StegoShieldSettings>({
    domains: [
      { domain: "chat.openai.com", enabled: true },
      { domain: "claude.ai", enabled: true },
      { domain: "gemini.google.com", enabled: true },
    ],
    ocrLang: "en",
    ocrMode: "local",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings on mount
    storage.get().then(setSettings);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await storage.set(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDomain = (domain: string) => {
    setSettings((prev) => ({
      ...prev,
      domains: prev.domains.map((d) =>
        d.domain === domain ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              StegoShield Options
            </h1>
            <p className="text-gray-600">
              Configure your extension preferences
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Domains Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Active Domains
              </h2>
            </div>
            <p className="text-gray-600 mb-4">
              Choose where StegoShield will automatically detect and analyze
              images
            </p>

            <div className="space-y-3">
              {settings.domains.map((domain) => (
                <label
                  key={domain.domain}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={domain.enabled}
                    onChange={() => toggleDomain(domain.domain)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{domain.domain}</p>
                    <p className="text-sm text-gray-500">
                      {domain.enabled
                        ? "Extension will run on this domain"
                        : "Extension disabled on this domain"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* OCR Settings Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                OCR Settings
              </h2>
            </div>

            <div className="grid gap-4">
              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Language
                </label>
                <select
                  value={settings.ocrLang}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      ocrLang: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese (Simplified)</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Processing Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      settings.ocrMode === "local"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ocrMode"
                      value="local"
                      checked={settings.ocrMode === "local"}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ocrMode: e.target.value as "local" | "cloud",
                        }))
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      <p className="font-medium text-gray-900">Local</p>
                      <p className="text-xs text-gray-500">
                        Process in browser
                      </p>
                    </div>
                  </label>

                  <label
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      settings.ocrMode === "cloud"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ocrMode"
                      value="cloud"
                      checked={settings.ocrMode === "cloud"}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ocrMode: e.target.value as "local" | "cloud",
                        }))
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Cloud className="w-5 h-5 text-white" />
                      </div>
                      <p className="font-medium text-gray-900">Cloud</p>
                      <p className="text-xs text-gray-500">Server processing</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
