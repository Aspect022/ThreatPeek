# Contributing to ThreatPeek 🤝

Thank you for your interest in contributing to ThreatPeek! This document provides guidelines and instructions for contributing to our cybersecurity platform.

## 👥 Project Team

ThreatPeek is developed by a collaborative team of four developers:

- **[Your Name]** - [Your Role]
- **[Friend 1 Name]** - [Their Role]
- **[Friend 2 Name]** - [Their Role]
- **[Friend 3 Name]** - [Their Role]

For detailed information about each team member's contributions, see [CONTRIBUTORS.md](./CONTRIBUTORS.md).

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

- **Node.js** 18+ and npm
- **Python** 3.8+ and pip
- **Git** with **Git LFS** (Large File Storage)
- **Docker** (optional, for containerized development)

### Git LFS Setup

Our project uses Git LFS to handle large files like videos, models, and datasets. Follow these steps:

1. **Install Git LFS** (if not already installed):
   ```bash
   # Windows (via Git installer or)
   git lfs install
   
   # macOS
   brew install git-lfs
   git lfs install
   
   # Ubuntu/Debian
   sudo apt-get install git-lfs
   git lfs install
   ```

2. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ThreatPeek-Project
   ```

3. **Pull LFS files** (if they exist):
   ```bash
   git lfs pull
   ```

### Repository Structure

```
ThreatPeek-Project/
├── AnomolyDetection/     # ML-based anomaly detection
├── Automation/           # n8n workflow automation
├── Backend/              # Node.js/Express API
├── Frontend/             # Next.js React application
├── StegnoShield/         # Python steganography service
├── StegnoShield Extension/ # Chrome browser extension
├── Resources/            # Additional resources
├── Other Resources/      # Demo videos and assets (Git LFS)
└── sandbox/              # Development playground
```

## 🔧 Development Setup

### 1. Backend Setup
```bash
cd Backend
npm install
cp .env.example .env  # Configure environment variables
npm run dev
```

### 2. Frontend Setup
```bash
cd Frontend
npm install
cp .env.local.example .env.local  # Configure environment variables
npm run dev
```

### 3. StegnoShield Service Setup
```bash
cd StegnoShield/stegoshield_service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. Browser Extension Setup
```bash
cd "StegnoShield Extension"
npm install
npm run dev
# Load unpacked extension in Chrome from build/chrome-mv3-dev
```

### 5. Anomaly Detection Setup
```bash
cd AnomolyDetection
python -m venv anomaly_env
source anomaly_env/bin/activate  # On Windows: anomaly_env\Scripts\activate
pip install -r requirements.txt
jupyter notebook
```

## 🌟 Contribution Guidelines

### Code Style and Standards

#### JavaScript/TypeScript
- Use **ESLint** and **Prettier** for code formatting
- Follow **React** best practices and hooks patterns
- Use **TypeScript** for type safety
- Implement proper error handling

#### Python
- Follow **PEP 8** style guidelines
- Use **type hints** where appropriate
- Document functions with **docstrings**
- Include **unit tests** for new functionality

#### General
- Write **clear, descriptive commit messages**
- Add **comments** for complex logic
- Update **documentation** for new features
- Ensure **backwards compatibility**

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build tasks, dependency updates

**Examples:**
```
feat(frontend): add real-time threat dashboard
fix(stegoshield): resolve OCR extraction error
docs(readme): update installation instructions
```

### Branching Strategy

We use a **feature branch workflow**:

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit:
   ```bash
   git add .
   git commit -m "feat(component): your descriptive message"
   ```

3. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request** with:
   - Clear description of changes
   - Screenshots/demos if applicable
   - Reference to related issues

## 🧪 Testing

### Running Tests

#### Backend Tests
```bash
cd Backend
npm test
npm run test:coverage
```

#### Frontend Tests
```bash
cd Frontend
npm test
npm run test:e2e
```

#### Python Tests
```bash
cd StegnoShield/stegoshield_service
pytest
pytest --cov=. --cov-report=html
```

### Test Coverage

- Maintain **>80% test coverage** for new code
- Include **unit tests** for core functionality
- Add **integration tests** for API endpoints
- Write **E2E tests** for critical user flows

## 📁 Large File Management

### Git LFS Guidelines

**Files managed by Git LFS:**
- Video files (`.mp4`, `.mov`, `.avi`, etc.)
- Large images (`.tiff`, `.bmp`, `.psd`, etc.)
- ML models (`.pkl`, `.h5`, `.model`, etc.)
- Database files (`.db`, `.sqlite`, etc.)
- Archives (`.zip`, `.rar`, `.7z`, etc.)

**Adding new LFS files:**
```bash
# LFS tracks these automatically based on .gitattributes
git add large-file.mp4
git commit -m "feat(demo): add demo video"
git push
```

**Important:** Large files in `Other Resources/` are handled by Git LFS automatically.

## 🔒 Security Guidelines

### Sensitive Information
- **Never commit** API keys, passwords, or secrets
- Use **environment variables** for configuration
- Add sensitive files to **`.gitignore`**
- Use **placeholder values** in example configs

### Code Security
- **Validate all inputs** on both client and server
- **Sanitize data** before database operations
- **Use HTTPS** for all API communications
- **Follow security best practices** for each technology

## 📝 Documentation

### Required Documentation
- **README files** for each component
- **API documentation** for backend endpoints
- **Code comments** for complex algorithms
- **Setup guides** for new contributors

### Documentation Style
- Use **clear, concise language**
- Include **code examples** where helpful
- Add **screenshots** for UI components
- Keep documentation **up to date** with code changes

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs actual behavior**
4. **Environment details** (OS, Node version, etc.)
5. **Screenshots or error logs** if applicable

## 💡 Feature Requests

For new feature suggestions:

1. **Check existing issues** to avoid duplicates
2. **Provide clear use case** and motivation
3. **Include mockups or examples** if applicable
4. **Consider implementation complexity**

## 📞 Communication

### Team Communication
- **GitHub Issues**: For bugs and feature requests
- **Pull Request Reviews**: For code discussions
- **Project Meetings**: Regular sync meetings
- **Discord/Slack**: Real-time team communication

### Response Times
- **Bug reports**: Within 48 hours
- **Feature requests**: Within 1 week
- **Pull requests**: Within 72 hours

## 🏆 Recognition

Contributors will be:
- **Listed in CONTRIBUTORS.md**
- **Credited in commit history**
- **Mentioned in release notes**
- **Acknowledged in presentations**

## 📄 License

By contributing to ThreatPeek, you agree that your contributions will be licensed under the MIT License.

## ❓ Questions?

If you have questions about contributing:

1. Check this document and other documentation
2. Search existing GitHub issues
3. Contact the team via GitHub issues
4. Reach out to team members directly

---

Thank you for contributing to ThreatPeek! Together, we're building a powerful cybersecurity platform. 🛡️
