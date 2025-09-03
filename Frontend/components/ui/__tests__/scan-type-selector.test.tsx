import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScanTypeSelector, type ScanConfig } from "../scan-type-selector";

// Mock the onScanStart function
const mockOnScanStart = jest.fn();

describe("ScanTypeSelector", () => {
  beforeEach(() => {
    mockOnScanStart.mockClear();
  });

  it("renders all scan type options", () => {
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    expect(screen.getByText("URL Scan")).toBeInTheDocument();
    expect(screen.getByText("Repository Scan")).toBeInTheDocument();
    expect(screen.getByText("Deep Scan")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });

  it("defaults to URL scan type", () => {
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // URL scan should be selected by default - check for Target URL input
    expect(screen.getByLabelText("Target URL")).toBeInTheDocument();
    expect(screen.queryByLabelText("Repository URL")).not.toBeInTheDocument();
  });

  it("switches scan types when clicked", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Click on Repository Scan
    await user.click(screen.getByText("Repository Scan"));

    // Repository input should appear
    expect(screen.getByLabelText("Repository URL")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("https://github.com/username/repository")
    ).toBeInTheDocument();
  });

  it("validates URL input correctly", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    const urlInput = screen.getByLabelText("Target URL");

    // Test invalid URL
    await user.type(urlInput, "invalid-url");
    expect(
      screen.getByText("Please enter a valid HTTP or HTTPS URL")
    ).toBeInTheDocument();

    // Test valid URL
    await user.clear(urlInput);
    await user.type(urlInput, "https://example.com");
    expect(
      screen.queryByText("Please enter a valid HTTP or HTTPS URL")
    ).not.toBeInTheDocument();
  });

  it("validates repository URL correctly", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Switch to repository scan
    await user.click(screen.getByText("Repository Scan"));

    const repoInput = screen.getByLabelText("Repository URL");

    // Test invalid repository URL
    await user.type(repoInput, "https://example.com/repo");
    expect(
      screen.getByText(/Please enter a valid GitHub or GitLab repository URL/)
    ).toBeInTheDocument();

    // Test valid GitHub URL
    await user.clear(repoInput);
    await user.type(repoInput, "https://github.com/user/repo");
    expect(
      screen.queryByText(/Please enter a valid GitHub or GitLab repository URL/)
    ).not.toBeInTheDocument();

    // Test valid GitLab URL
    await user.clear(repoInput);
    await user.type(repoInput, "https://gitlab.com/user/repo");
    expect(
      screen.queryByText(/Please enter a valid GitHub or GitLab repository URL/)
    ).not.toBeInTheDocument();
  });

  it("shows advanced options when toggled", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Advanced options should not be visible initially
    expect(screen.queryByText("Detection Types")).not.toBeInTheDocument();

    // Toggle advanced options
    const advancedToggle = screen.getByRole("switch", {
      name: /advanced options/i,
    });
    await user.click(advancedToggle);

    // Advanced options should now be visible
    expect(screen.getByText("Detection Types")).toBeInTheDocument();
    expect(screen.getByText("Performance Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Secret Detection")).toBeInTheDocument();
    expect(screen.getByLabelText("File Detection")).toBeInTheDocument();
    expect(screen.getByLabelText("Security Headers")).toBeInTheDocument();
    expect(screen.getByLabelText("OWASP Checks")).toBeInTheDocument();
  });

  it("calls onScanStart with correct config for URL scan", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Enter URL
    const urlInput = screen.getByLabelText("Target URL");
    await user.type(urlInput, "https://example.com");

    // Click scan button
    const scanButton = screen.getByRole("button", { name: /start url scan/i });
    await user.click(scanButton);

    expect(mockOnScanStart).toHaveBeenCalledWith({
      scanType: "url",
      url: "https://example.com",
      options: {
        includeSecrets: true,
        includeFiles: true,
        includeHeaders: true,
        includeOwasp: true,
        maxDepth: 3,
        timeout: 30,
        confidenceThreshold: 0.7,
      },
    });
  });

  it("calls onScanStart with correct config for repository scan", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Switch to repository scan
    await user.click(screen.getByText("Repository Scan"));

    // Enter repository URL
    const repoInput = screen.getByLabelText("Repository URL");
    await user.type(repoInput, "https://github.com/user/repo");

    // Click scan button
    const scanButton = screen.getByRole("button", {
      name: /start repository scan/i,
    });
    await user.click(scanButton);

    expect(mockOnScanStart).toHaveBeenCalledWith({
      scanType: "repository",
      repositoryUrl: "https://github.com/user/repo",
      options: {
        includeSecrets: true,
        includeFiles: true,
        includeHeaders: true,
        includeOwasp: true,
        maxDepth: 3,
        timeout: 30,
        confidenceThreshold: 0.7,
      },
    });
  });

  it("calls onScanStart with correct config for deep scan", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Switch to deep scan
    await user.click(screen.getByText("Deep Scan"));

    // Enter URL
    const urlInput = screen.getByLabelText("Target URL");
    await user.type(urlInput, "https://example.com");

    // Click scan button
    const scanButton = screen.getByRole("button", { name: /start deep scan/i });
    await user.click(scanButton);

    expect(mockOnScanStart).toHaveBeenCalledWith({
      scanType: "deep",
      url: "https://example.com",
      options: {
        includeSecrets: true,
        includeFiles: true,
        includeHeaders: true,
        includeOwasp: true,
        maxDepth: 3,
        timeout: 30,
        confidenceThreshold: 0.7,
      },
    });
  });

  it("prevents scan with invalid URL", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Enter invalid URL
    const urlInput = screen.getByLabelText("Target URL");
    await user.type(urlInput, "invalid-url");

    // Try to click scan button
    const scanButton = screen.getByRole("button", { name: /start url scan/i });
    await user.click(scanButton);

    // Should show error and not call onScanStart
    expect(screen.getByText("Please enter a valid URL")).toBeInTheDocument();
    expect(mockOnScanStart).not.toHaveBeenCalled();
  });

  it("prevents scan with invalid repository URL", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Switch to repository scan
    await user.click(screen.getByText("Repository Scan"));

    // Enter invalid repository URL
    const repoInput = screen.getByLabelText("Repository URL");
    await user.type(repoInput, "https://example.com/repo");

    // Try to click scan button
    const scanButton = screen.getByRole("button", {
      name: /start repository scan/i,
    });
    await user.click(scanButton);

    // Should show error and not call onScanStart
    expect(
      screen.getByText("Please enter a valid repository URL")
    ).toBeInTheDocument();
    expect(mockOnScanStart).not.toHaveBeenCalled();
  });

  it("disables scan button when loading", () => {
    render(<ScanTypeSelector onScanStart={mockOnScanStart} isLoading={true} />);

    const scanButton = screen.getByRole("button", { name: /scanning/i });
    expect(scanButton).toBeDisabled();
    expect(screen.getByText("Scanning...")).toBeInTheDocument();
  });

  it("updates advanced options correctly", async () => {
    const user = userEvent.setup();
    render(<ScanTypeSelector onScanStart={mockOnScanStart} />);

    // Toggle advanced options
    const advancedToggle = screen.getByRole("switch", {
      name: /advanced options/i,
    });
    await user.click(advancedToggle);

    // Toggle off secret detection
    const secretToggle = screen.getByLabelText("Secret Detection");
    await user.click(secretToggle);

    // Enter URL and scan
    const urlInput = screen.getByLabelText("Target URL");
    await user.type(urlInput, "https://example.com");

    const scanButton = screen.getByRole("button", { name: /start url scan/i });
    await user.click(scanButton);

    expect(mockOnScanStart).toHaveBeenCalledWith({
      scanType: "url",
      url: "https://example.com",
      options: {
        includeSecrets: false, // Should be false now
        includeFiles: true,
        includeHeaders: true,
        includeOwasp: true,
        maxDepth: 3,
        timeout: 30,
        confidenceThreshold: 0.7,
      },
    });
  });
});
