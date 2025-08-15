import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AIExplanationDisplay,
  type AIExplanation,
} from "../ai-explanation-display";

// Mock clipboard API
const mockWriteText = jest.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

const mockExplanation: AIExplanation = {
  id: "explanation-1",
  findingId: "finding-1",
  title: "Exposed AWS API Key",
  summary:
    "An AWS API key has been found exposed in your JavaScript code, which could allow unauthorized access to your AWS resources.",
  impact: {
    severity: "critical",
    description:
      "This vulnerability allows attackers to access your AWS resources using the exposed credentials.",
    businessImpact: [
      "Unauthorized access to AWS services",
      "Potential data breaches",
      "Unexpected AWS charges",
    ],
    technicalImpact: [
      "Full access to AWS resources",
      "Ability to modify or delete data",
      "Service disruption",
    ],
  },
  explanation: {
    whatIsIt:
      "An AWS API key is a credential used to authenticate requests to AWS services.",
    whyDangerous:
      "When exposed, it allows anyone to access your AWS resources with the permissions associated with that key.",
    howItHappens:
      "API keys are often accidentally committed to version control or embedded in client-side code.",
    commonScenarios: [
      "Hardcoded in JavaScript files",
      "Committed to public repositories",
      "Included in configuration files",
    ],
  },
  remediation: {
    immediateSteps: [
      {
        step: 1,
        title: "Rotate the API Key",
        description:
          "Immediately disable the exposed key and generate a new one.",
        priority: "high",
        estimatedTime: "5 minutes",
        codeExample:
          "aws iam delete-access-key --access-key-id AKIAIOSFODNN7EXAMPLE",
      },
      {
        step: 2,
        title: "Remove from Code",
        description: "Remove the hardcoded key from your source code.",
        priority: "high",
        estimatedTime: "10 minutes",
      },
    ],
    longTermSteps: [
      {
        step: 1,
        title: "Implement Environment Variables",
        description:
          "Use environment variables to store sensitive credentials.",
        priority: "medium",
        estimatedTime: "30 minutes",
        codeExample: "const apiKey = process.env.AWS_ACCESS_KEY_ID",
      },
    ],
    codeExamples: [
      {
        title: "Secure API Key Usage",
        description: "Use environment variables instead of hardcoding keys",
        language: "javascript",
        before: 'const apiKey = "AKIAIOSFODNN7EXAMPLE";',
        after: "const apiKey = process.env.AWS_ACCESS_KEY_ID;",
        explanation:
          "Environment variables keep sensitive data out of your source code",
      },
    ],
    bestPractices: [
      "Never commit API keys to version control",
      "Use IAM roles when possible",
      "Implement key rotation policies",
      "Monitor API key usage",
    ],
  },
  references: [
    {
      title: "AWS Security Best Practices",
      url: "https://docs.aws.amazon.com/general/latest/gr/aws-security-best-practices.html",
      type: "documentation",
    },
    {
      title: "Managing AWS Access Keys",
      url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
      type: "documentation",
    },
  ],
  confidence: 0.95,
  generatedAt: "2024-01-01T10:00:00Z",
};

describe("AIExplanationDisplay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteText.mockClear();
  });

  it("renders the explanation title and summary", () => {
    render(<AIExplanationDisplay explanation={mockExplanation} />);

    expect(screen.getByText("Exposed AWS API Key")).toBeInTheDocument();
    expect(screen.getByText("AI-Generated Analysis")).toBeInTheDocument();
    expect(screen.getByText("95% confidence")).toBeInTheDocument();
  });

  it("shows severity badge with correct styling", () => {
    render(<AIExplanationDisplay explanation={mockExplanation} />);

    const severityBadge = screen.getByText("Critical Impact");
    expect(severityBadge).toBeInTheDocument();
    expect(severityBadge).toHaveClass("text-red-600");
  });

  it("expands and collapses when clicked", async () => {
    const user = userEvent.setup();
    render(<AIExplanationDisplay explanation={mockExplanation} />);

    // Should be collapsed initially
    expect(screen.queryByText("Summary")).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText("Exposed AWS API Key"));
    expect(screen.getByText("Summary")).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByText("Exposed AWS API Key"));
    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
  });

  it("displays detailed explanation sections when expanded", async () => {
    const user = userEvent.setup();
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Impact Analysis")).toBeInTheDocument();
    expect(screen.getByText("Detailed Explanation")).toBeInTheDocument();
    expect(screen.getByText("Remediation Steps")).toBeInTheDocument();
    expect(
      screen.getByText("References & Further Reading")
    ).toBeInTheDocument();
  });

  it("shows business and technical impact lists", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("Business Impact")).toBeInTheDocument();
    expect(screen.getByText("Technical Impact")).toBeInTheDocument();
    expect(
      screen.getByText("Unauthorized access to AWS services")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Full access to AWS resources")
    ).toBeInTheDocument();
  });

  it("displays immediate and long-term remediation steps", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("Immediate Actions")).toBeInTheDocument();
    expect(screen.getByText("Long-term Improvements")).toBeInTheDocument();
    expect(screen.getByText("Rotate the API Key")).toBeInTheDocument();
    expect(
      screen.getByText("Implement Environment Variables")
    ).toBeInTheDocument();
  });

  it("shows priority badges for remediation steps", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    const highPriorityBadges = screen.getAllByText("high priority");
    expect(highPriorityBadges.length).toBeGreaterThan(0);
    expect(highPriorityBadges[0]).toHaveClass("bg-red-100", "text-red-800");

    const mediumPriorityBadge = screen.getByText("medium priority");
    expect(mediumPriorityBadge).toHaveClass("bg-yellow-100", "text-yellow-800");
  });

  it("displays code examples with before and after", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("Code Examples")).toBeInTheDocument();
    expect(screen.getByText("Secure API Key Usage")).toBeInTheDocument();
    expect(screen.getByText("❌ Before (Vulnerable)")).toBeInTheDocument();
    expect(screen.getByText("✅ After (Secure)")).toBeInTheDocument();
    expect(
      screen.getByText('const apiKey = "AKIAIOSFODNN7EXAMPLE";')
    ).toBeInTheDocument();
    expect(
      screen.getByText("const apiKey = process.env.AWS_ACCESS_KEY_ID;")
    ).toBeInTheDocument();
  });

  it("shows best practices list", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("Best Practices")).toBeInTheDocument();
    expect(
      screen.getByText("Never commit API keys to version control")
    ).toBeInTheDocument();
    expect(screen.getByText("Use IAM roles when possible")).toBeInTheDocument();
  });

  it("displays reference links", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(
      screen.getByText("References & Further Reading")
    ).toBeInTheDocument();

    const awsSecurityLink = screen.getByText("AWS Security Best Practices");
    expect(awsSecurityLink).toBeInTheDocument();
    expect(awsSecurityLink.closest("a")).toHaveAttribute(
      "href",
      "https://docs.aws.amazon.com/general/latest/gr/aws-security-best-practices.html"
    );
    expect(awsSecurityLink.closest("a")).toHaveAttribute("target", "_blank");
  });

  it("has copy buttons when showCopyButtons is true", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    // Should have copy buttons
    const copyButtons = screen.getAllByTitle("Copy to clipboard");
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it("shows check icon after successful copy", async () => {
    const user = userEvent.setup();
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    const copyButtons = screen.getAllByTitle("Copy to clipboard");
    await user.click(copyButtons[0]);

    // Should show check icon briefly - look for the check icon specifically
    await waitFor(() => {
      const checkIcons = screen
        .getAllByRole("button")
        .filter((button) => button.querySelector("svg.lucide-check"));
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });

  it("hides copy buttons when showCopyButtons is false", async () => {
    render(
      <AIExplanationDisplay
        explanation={mockExplanation}
        isExpanded={true}
        showCopyButtons={false}
      />
    );

    expect(screen.queryByTitle("Copy to clipboard")).not.toBeInTheDocument();
  });

  it("calls onToggle callback when expanded state changes", async () => {
    const mockOnToggle = jest.fn();
    const user = userEvent.setup();

    render(
      <AIExplanationDisplay
        explanation={mockExplanation}
        onToggle={mockOnToggle}
      />
    );

    await user.click(screen.getByText("Exposed AWS API Key"));
    expect(mockOnToggle).toHaveBeenCalledWith(true);

    await user.click(screen.getByText("Exposed AWS API Key"));
    expect(mockOnToggle).toHaveBeenCalledWith(false);
  });

  it("displays generation timestamp and confidence", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText(/Generated on/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 95%/)).toBeInTheDocument();
  });

  it("shows estimated time for remediation steps", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("~5 minutes")).toBeInTheDocument();
    expect(screen.getByText("~10 minutes")).toBeInTheDocument();
    expect(screen.getByText("~30 minutes")).toBeInTheDocument();
  });

  it("displays common scenarios", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    expect(screen.getByText("Common Scenarios")).toBeInTheDocument();
    expect(
      screen.getByText("Hardcoded in JavaScript files")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Committed to public repositories")
    ).toBeInTheDocument();
  });

  it("shows step numbers for remediation steps", async () => {
    render(
      <AIExplanationDisplay explanation={mockExplanation} isExpanded={true} />
    );

    // Should show step numbers in circles
    const stepNumbers = screen.getAllByText("1");
    expect(stepNumbers.length).toBeGreaterThan(0);

    const stepTwo = screen.getByText("2");
    expect(stepTwo).toBeInTheDocument();
  });

  it("handles different severity levels correctly", async () => {
    const mediumSeverityExplanation = {
      ...mockExplanation,
      impact: {
        ...mockExplanation.impact,
        severity: "medium" as const,
      },
    };

    render(<AIExplanationDisplay explanation={mediumSeverityExplanation} />);

    const severityBadge = screen.getByText("Medium Impact");
    expect(severityBadge).toHaveClass("text-yellow-600");
  });
});
