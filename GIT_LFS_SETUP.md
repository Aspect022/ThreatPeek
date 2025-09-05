# Git LFS Setup Instructions 📁

This document provides step-by-step instructions for setting up Git LFS (Large File Storage) to handle large files like videos in the ThreatPeek project.

## 🚀 Quick Setup

### 1. Install Git LFS

If you haven't installed Git LFS yet:

```bash
# Windows (if you have Git for Windows)
git lfs install

# Or download from: https://git-lfs.github.io/

# macOS (with Homebrew)
brew install git-lfs
git lfs install

# Ubuntu/Debian
sudo apt-get install git-lfs
git lfs install

# CentOS/RHEL/Fedora
sudo yum install git-lfs  # or sudo dnf install git-lfs
git lfs install
```

### 2. Initialize Git LFS in Your Repository

```bash
# Navigate to your project directory
cd "D:\Projects\FullStack\Inspectify\ThreatPeek - Hack\ThreatPeek-Project"

# Initialize Git LFS (if not already done)
git lfs install
```

### 3. Track Large Files

The `.gitattributes` file is already configured to track large files automatically. You can see which files are tracked by running:

```bash
git lfs track
```

This should show all the file patterns we've configured for LFS.

## 📹 Handling Existing Large Files

If you already have large files (like videos) that were committed before LFS:

### Option 1: Migrate Existing Files to LFS

```bash
# Migrate specific file types to LFS
git lfs migrate import --include="*.mp4,*.mov,*.avi"

# Or migrate specific files
git lfs migrate import --include="Other Resources/*.mp4"
```

### Option 2: Remove and Re-add Large Files

If migration doesn't work or you prefer a clean approach:

```bash
# Remove large files from git history (but keep local copies)
git rm --cached "Other Resources"/*.mp4
git rm --cached "Other Resources"/*.mov

# Commit the removal
git commit -m "Remove large video files before LFS setup"

# Now add them back (they'll be tracked by LFS automatically)
git add "Other Resources"/*.mp4
git add "Other Resources"/*.mov

# Commit with LFS
git commit -m "Add video files with Git LFS"
```

## 🔧 Common Commands

### Check LFS Status
```bash
# See which files are tracked by LFS
git lfs ls-files

# Check LFS status
git lfs status

# See LFS environment info
git lfs env
```

### Adding New Large Files
```bash
# Large files matching patterns in .gitattributes are tracked automatically
git add large-video.mp4
git commit -m "Add demo video"
git push
```

### Pulling LFS Files
```bash
# Pull all LFS files
git lfs pull

# Pull LFS files for a specific commit
git lfs pull origin main
```

### Checking File Info
```bash
# See if a file is tracked by LFS
git lfs ls-files | grep filename

# Get detailed info about LFS files
git lfs ls-files --long
```

## 🚨 Troubleshooting

### Issue: "This exceeds GitHub's file size limit"

```bash
# Check file sizes
git lfs ls-files --size

# Make sure LFS is tracking the large files
git lfs track "*.mp4"
git add .gitattributes
git commit -m "Update LFS tracking"
```

### Issue: Files not being tracked by LFS

```bash
# Check if patterns are correct in .gitattributes
cat .gitattributes | grep -E "mp4|mov"

# Manually track specific patterns
git lfs track "*.mp4"
git lfs track "**/*.mov"

# Add and commit the .gitattributes changes
git add .gitattributes
git commit -m "Update LFS tracking patterns"
```

### Issue: LFS quota exceeded

```bash
# Check LFS usage (on GitHub)
git lfs ls-files --size

# Consider removing unnecessary large files
git rm large-unnecessary-file.mp4
git commit -m "Remove unnecessary large file"
```

## 📊 File Size Guidelines

### Recommended for Git LFS:
- **Videos**: All formats (MP4, MOV, AVI, etc.)
- **Large Images**: > 1MB (TIFF, BMP, PSD, RAW)
- **ML Models**: > 10MB (PKL, H5, MODEL files)
- **Datasets**: > 10MB (Large CSV, JSON files)
- **Archives**: All ZIP, RAR, 7Z files

### Keep in Regular Git:
- **Small Images**: < 1MB (PNG, JPG for UI)
- **Code Files**: All source code
- **Config Files**: JSON, YAML, etc.
- **Documentation**: Markdown, text files

## 🔄 Migration Strategy for Your Project

### Step 1: Backup Your Project
```bash
# Create a backup
cp -r "ThreatPeek-Project" "ThreatPeek-Project-backup"
```

### Step 2: Check Current Large Files
```bash
# Find large files in your repo
find . -type f -size +10M -not -path "./node_modules/*" -not -path "./.git/*"
```

### Step 3: Clean Migration
```bash
# Remove large files from tracking (keep local copies)
git rm --cached "Other Resources"/*.mp4
git rm --cached "Other Resources"/*.mov
git commit -m "Remove large files before LFS migration"

# Add them back with LFS
git add "Other Resources"/*.mp4
git add "Other Resources"/*.mov
git commit -m "Add large files with Git LFS"

# Push changes
git push origin main
```

## ✅ Verification

After setup, verify everything is working:

```bash
# Check LFS files are tracked
git lfs ls-files

# Check file sizes
git lfs ls-files --size

# Verify push works
git push origin main
```

## 💡 Best Practices

1. **Always configure LFS before adding large files**
2. **Use .gitattributes patterns** instead of manually tracking files
3. **Test LFS setup** with a small large file first
4. **Monitor LFS quota** if using GitHub or other services
5. **Document large file requirements** for team members

## 📞 Getting Help

If you encounter issues:

1. Check the [Git LFS documentation](https://git-lfs.github.io/)
2. Run `git lfs env` to check configuration
3. Check GitHub's [LFS documentation](https://docs.github.com/en/repositories/working-with-files/managing-large-files)
4. Contact the team if you need help

---

**Note**: The `.gitattributes` and `.gitignore` files are already configured for your project. Follow the steps above to set up Git LFS and handle your large video files properly.
