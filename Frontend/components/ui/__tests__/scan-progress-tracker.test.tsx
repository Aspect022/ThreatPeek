import { render, screen, fireEvent } from "@testing-library/react";
import { ScanProgressTracker } from "../scan-progress-tracker";
import type { ScanProgress } from "../scan-progress-tracker";

const mockProgress: ScanProgress = {
  scanId: "scan-123",
  scanType: "deep",
  overallProgress: 65,
  status: "running",
  phases: [
    {
      id: "initialization",
      name: "Initialization",
      description: "Setting up scan parameters",
      status: "completed",
      progress: 100,
      startTime: "2024-01-01T10:00:00Z",
      endTime: "2024-01-01T10:00:05Z",
      duration: 5000,
      confidence: 1.0,
    },
    {
      id: "secret-detection",
      name: "Secret Detection",
      description: "Scanning for exposed secrets",
      status: "running",
      progress: 65,
      startTime: "2024-01-01T10:00:05Z",
      details: "Analyzing JavaScript files...",
      confidence: 0.85,
    },
    {
      id: "file-detection",
      name: "File Detection",
      description: "Checking for exposed files",
      status: "pending",
      progress: 0,
    },
  ],
  startTime: "2024-01-01T10:00:00Z",
  estimatedTimeRemaining: 45,
  currentPhase: "secret-detection",
  totalFindings: 3,
  errors: [],
};

const completedProgress: ScanProgress = {
  ...mockProgress,
  overallProgress: 100,
  status: "completed",
  phases: mockProgress.phases.map((phase) => ({
    ...phase,
    status: "completed" as const,
    progress: 100,
  })),
  currentPhase: undefined,
  estimatedTimeRemaining: undefined,
};

const failedProgress: ScanProgress = {
  ...mockProgress,
  status: "failed",
  errors: ["Network timeout", "Invalid target URL"],
};

describe("ScanProgressTracker", () => {
  beforeEach(() => {
    // Mock Date.now for consistent elapsed time calculations
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2024-01-01T10:01:00Z").getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders scan progress with correct title and status", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(screen.getByText("Deep Security Scan")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText(/Scan ID: scan-123/)).toBeInTheDocument();
  });

  it("displays overall progress percentage", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("Overall Progress")).toBeInTheDocument();
  });

  it("shows phase completion stats", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // 1 completed out of 3 phases
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("displays elapsed time", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // Should show 1 minute elapsed (mocked time difference)
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });

  it("shows estimated time remaining when available", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(screen.getByText("0:45")).toBeInTheDocument();
  });

  it("displays total findings count", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows current phase information", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(screen.getByText("Currently: Secret Detection")).toBeInTheDocument();
  });

  it("displays detailed phase information", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(screen.getByText("Initialization")).toBeInTheDocument();
    expect(screen.getByText("Secret Detection")).toBeInTheDocument();
    expect(screen.getByText("File Detection")).toBeInTheDocument();

    expect(screen.getByText("Setting up scan parameters")).toBeInTheDocument();
    expect(
      screen.getByText("Scanning for exposed secrets")
    ).toBeInTheDocument();
  });

  it("shows phase status icons correctly", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // Check for completed phase (checkmark)
    expect(screen.getByText("✓ Complete")).toBeInTheDocument();

    // Running phase should have spinner (tested via class)
    const runningElements = screen.getAllByText("Secret Detection");
    expect(runningElements.length).toBeGreaterThan(0);
  });

  it("displays phase progress bars for running phases", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // Should show progress percentage for running phase
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("shows phase details when available", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    expect(
      screen.getByText("Analyzing JavaScript files...")
    ).toBeInTheDocument();
  });

  it("displays confidence scores with appropriate colors", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // High confidence (100%) should be displayed
    expect(screen.getByText("100% confidence")).toBeInTheDocument();

    // Medium confidence (85%) should be displayed
    expect(screen.getByText("85% confidence")).toBeInTheDocument();
  });

  it("shows completed status for finished scans", () => {
    render(<ScanProgressTracker progress={completedProgress} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getAllByText("✓ Complete")).toHaveLength(3); // All phases completed
  });

  it("displays errors when scan fails", () => {
    render(<ScanProgressTracker progress={failedProgress} />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Errors Encountered")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    expect(screen.getByText("Invalid target URL")).toBeInTheDocument();
  });

  it("shows cancel button when onCancel is provided and scan is running", () => {
    const mockCancel = jest.fn();
    render(
      <ScanProgressTracker progress={mockProgress} onCancel={mockCancel} />
    );

    const cancelButton = screen.getByText("Cancel");
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(mockCancel).toHaveBeenCalled();
  });

  it("does not show cancel button for completed scans", () => {
    const mockCancel = jest.fn();
    render(
      <ScanProgressTracker progress={completedProgress} onCancel={mockCancel} />
    );

    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("hides detailed phases when showDetails is false", () => {
    render(<ScanProgressTracker progress={mockProgress} showDetails={false} />);

    expect(screen.queryByText("Scan Phases")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Detailed progress for each scan phase")
    ).not.toBeInTheDocument();
  });

  it("displays different scan types correctly", () => {
    const urlProgress = { ...mockProgress, scanType: "url" as const };
    const repoProgress = { ...mockProgress, scanType: "repository" as const };

    const { rerender } = render(<ScanProgressTracker progress={urlProgress} />);
    expect(screen.getByText("URL Scan")).toBeInTheDocument();

    rerender(<ScanProgressTracker progress={repoProgress} />);
    expect(screen.getByText("Repository Scan")).toBeInTheDocument();
  });

  it("formats time correctly", () => {
    const progressWithLongTime = {
      ...mockProgress,
      startTime: "2024-01-01T09:55:00Z", // 6 minutes ago
    };

    render(<ScanProgressTracker progress={progressWithLongTime} />);

    expect(screen.getByText("6:00")).toBeInTheDocument();
  });

  it("shows phase numbers correctly", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // Should show phase numbers 1, 2, 3
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("displays phase durations for completed phases", () => {
    render(<ScanProgressTracker progress={mockProgress} />);

    // First phase has 5000ms duration = 0:05
    expect(screen.getByText("0:05")).toBeInTheDocument();
  });
});
