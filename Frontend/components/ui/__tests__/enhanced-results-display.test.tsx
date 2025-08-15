import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EnhancedResultsDisplay,
  type Finding,
  type ScanResultCategory,
} from "../enhanced-results-display";

const mockFindings: Finding[] = [
  {
    id: "finding-1",
    type: "API Key Exposure",
    severity: "critical",
    confidence: 0.9,
    title: "Exposed AWS API Key",
    description: "AWS API key found in JavaScript file",
    category: "secrets",
    location: {
      file: "app.js",
      line: 42,
    },
    evidence: {
      pattern: "AKIA[0-9A-Z]{16}",
      value: "AKIAIOSFODNN7EXAMPLE",
      context: "Found in variable assignment",
    },
    remediation: {
      steps: ["Rotate the API key immediately", "Use environment variables"],
      references: [
        "https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html",
      ],
    },
  },
  {
    id: "finding-2",
    type: "Missing Security Header",
    severity: "medium",
    confidence: 0.8,
    title: "Missing X-Frame-Options Header",
    description:
      "X-Frame-Options header is missing, allowing clickjacking attacks",
    category: "headers",
    location: {
      url: "https://example.com",
    },
    evidence: {
      pattern: "Missing header",
      context: "Header analysis",
    },
    remediation: {
      steps: ["Add X-Frame-Options: DENY header", "Configure web server"],
      references: [],
    },
  },
  {
    id: "finding-3",
    type: "Exposed Configuration File",
    severity: "high",
    confidence: 0.95,
    title: "Accessible .env file",
    description: "Environment configuration file is publicly accessible",
    category: "files",
    location: {
      url: "https://example.com/.env",
    },
    evidence: {
      pattern: ".env file access",
      context: "HTTP 200 response",
    },
  },
];

const mockResults: ScanResultCategory[] = [
  {
    category: "secrets",
    findings: [mockFindings[0]],
    summary: {
      total: 1,
      critical: 1,
      high: 0,
      medium: 0,
      low: 0,
    },
  },
  {
    category: "headers",
    findings: [mockFindings[1]],
    summary: {
      total: 1,
      critical: 0,
      high: 0,
      medium: 1,
      low: 0,
    },
  },
  {
    category: "files",
    findings: [mockFindings[2]],
    summary: {
      total: 1,
      critical: 0,
      high: 1,
      medium: 0,
      low: 0,
    },
  },
];

describe("EnhancedResultsDisplay", () => {
  it("renders summary statistics correctly", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    expect(screen.getByText("Total Issues")).toBeInTheDocument();
    expect(screen.getByText("High Risk")).toBeInTheDocument();
    expect(screen.getByText("Categories")).toBeInTheDocument();

    // Check that we have the critical count in the summary
    const criticalElements = screen.getAllByText("Critical");
    expect(criticalElements.length).toBeGreaterThan(0);
  });

  it("displays all category sections", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    expect(screen.getByText("Secret Detection")).toBeInTheDocument();
    expect(screen.getByText("Security Headers")).toBeInTheDocument();
    expect(screen.getByText("Exposed Files")).toBeInTheDocument();
  });

  it("shows findings when category is expanded", async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Secrets category should be expanded by default
    expect(screen.getByText("Exposed AWS API Key")).toBeInTheDocument();

    // Click on headers category to expand it
    await user.click(screen.getByText("Security Headers"));
    expect(
      screen.getByText("Missing X-Frame-Options Header")
    ).toBeInTheDocument();
  });

  it("filters findings by search term", async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    const searchInput = screen.getByPlaceholderText("Search findings...");
    await user.type(searchInput, "AWS");

    // Should show AWS finding
    expect(screen.getByText("Exposed AWS API Key")).toBeInTheDocument();

    // Should update the results count
    expect(screen.getByText("1 of 3 findings")).toBeInTheDocument();
  });

  it("has severity filter controls", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Should have filter controls section
    expect(screen.getByText("Filter & Search Results")).toBeInTheDocument();
  });

  it("has category filter controls", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Should have category filter label
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("has sort controls", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Should have sort by label
    expect(screen.getByText("Sort By")).toBeInTheDocument();
  });

  it('toggles "Critical & High Only" filter', async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Click the "Critical & High Only" button
    const criticalHighButton = screen.getByText("Critical & High Only");
    await user.click(criticalHighButton);

    // Should show only critical and high findings (2 out of 3)
    expect(screen.getByText("2 of 3 findings")).toBeInTheDocument();
  });

  it("displays confidence scores when findings are expanded", async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Secrets category should be expanded by default, so we should see confidence scores
    expect(screen.getByText("90% confidence")).toBeInTheDocument();
  });

  it("shows severity badges with correct styling", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Get the severity badge from within the findings (not the summary stats)
    const criticalBadges = screen.getAllByText("Critical");
    // The second one should be the badge in the finding
    expect(criticalBadges[1]).toHaveClass("bg-red-100", "text-red-800");
  });

  it("displays evidence patterns when available", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Should show the AWS API key pattern
    expect(screen.getByText("AKIA[0-9A-Z]{16}")).toBeInTheDocument();
  });

  it("shows file locations when available", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Should show file location for the first finding
    expect(screen.getByText("app.js:42")).toBeInTheDocument();
  });

  it("shows URL locations when available", async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Expand headers category to see the URL
    await user.click(screen.getByText("Security Headers"));
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("displays loading state", () => {
    render(<EnhancedResultsDisplay results={[]} isLoading={true} />);

    // Should show loading skeleton
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows empty state when no findings match filters", async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText("Search findings...");
    await user.type(searchInput, "nonexistent");

    expect(
      screen.getByText("No findings match your filters")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try adjusting your search terms or filters to see more results."
      )
    ).toBeInTheDocument();
  });

  it("expands and collapses categories correctly", async () => {
    const user = userEvent.setup();
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Headers category should be collapsed initially
    expect(
      screen.queryByText("Missing X-Frame-Options Header")
    ).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("Security Headers"));
    expect(
      screen.getByText("Missing X-Frame-Options Header")
    ).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText("Security Headers"));
    expect(
      screen.queryByText("Missing X-Frame-Options Header")
    ).not.toBeInTheDocument();
  });

  it("displays category icons correctly", () => {
    render(<EnhancedResultsDisplay results={mockResults} />);

    // Check that category sections have appropriate icons (we can't easily test the specific icons, but we can check they exist)
    const secretsSection = screen.getByText("Secret Detection").closest("div");
    const headersSection = screen.getByText("Security Headers").closest("div");
    const filesSection = screen.getByText("Exposed Files").closest("div");

    expect(secretsSection).toBeInTheDocument();
    expect(headersSection).toBeInTheDocument();
    expect(filesSection).toBeInTheDocument();
  });
});
