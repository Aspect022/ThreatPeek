# StegnoShield - Steganography Analysis Service 🔐

Advanced steganography detection and analysis service using computer vision and machine learning techniques to identify hidden content in images and multimedia files.

## 🎯 Overview

StegnoShield is a specialized microservice within the ThreatPeek ecosystem that provides:

- **Steganography Detection**: Identify hidden content in images and media files
- **Multiple Algorithm Support**: Various steganographic technique detection
- **OCR Capabilities**: Extract and analyze text from images
- **Metadata Analysis**: Deep inspection of file metadata
- **Real-time Processing**: Fast analysis for web and extension integration
- **RESTful API**: Easy integration with other ThreatPeek components

## 🛠️ Technology Stack

- **Language**: Python 3.8+
- **Web Framework**: FastAPI/Uvicorn
- **Image Processing**: OpenCV, PIL/Pillow
- **OCR Engine**: Tesseract OCR
- **Computer Vision**: scikit-image, NumPy
- **API Documentation**: Automatic OpenAPI/Swagger docs
- **Deployment**: Docker-ready containerization

## 🏗️ Architecture

```
StegnoShield/
├── 📂 stegoshield_service/          # Main service directory
│   ├── 📄 main.py                   # FastAPI application entry point
│   ├── 📄 requirements.txt          # Python dependencies
│   ├── 📄 README.md                 # Service-specific documentation
│   ├── 📂 api/                      # API route definitions
│   │   ├── 📄 __init__.py
│   │   ├── 📄 analyze.py           # Analysis endpoints
│   │   └── 📄 health.py            # Health check endpoints
│   ├── 📂 core/                     # Core business logic
│   │   ├── 📄 __init__.py
│   │   ├── 📄 steganography.py     # Stego detection algorithms
│   │   ├── 📄 ocr_processor.py     # OCR functionality
│   │   ├── 📄 metadata_analyzer.py # Metadata extraction
│   │   └── 📄 image_processor.py   # Image processing utilities
│   ├── 📂 models/                   # ML models for detection
│   │   ├── 📄 __init__.py
│   │   ├── 📄 lsb_detector.py      # LSB steganography detection
│   │   ├── 📄 dct_detector.py      # DCT-based detection
│   │   └── 📄 statistical_detector.py # Statistical analysis
│   ├── 📂 utils/                    # Utility functions
│   │   ├── 📄 __init__.py
│   │   ├── 📄 file_utils.py        # File handling utilities
│   │   ├── 📄 image_utils.py       # Image processing helpers
│   │   └── 📄 validation.py        # Input validation
│   └── 📂 tests/                    # Unit and integration tests
│       ├── 📄 test_api.py
│       ├── 📄 test_steganography.py
│       └── 📄 test_ocr.py
├── 📄 docker-compose.yml           # Docker composition
├── 📄 Dockerfile                   # Container definition
└── 📄 .dockerignore               # Docker ignore patterns
```

## 🚀 Quick Start

### Prerequisites

#### System Dependencies
- **Tesseract OCR**: Required for text extraction
  ```bash
  # Ubuntu/Debian
  sudo apt-get install tesseract-ocr
  
  # macOS
  brew install tesseract
  
  # Windows
  # Download from: https://github.com/UB-Mannheim/tesseract/wiki
  ```

#### Python Requirements
- Python 3.8 or higher
- pip (Python package installer)

### Installation

1. **Navigate to StegnoShield directory**
   ```bash
   cd StegnoShield/stegoshield_service
   ```

2. **Create virtual environment** (recommended)
   ```bash
   python -m venv stego_env
   
   # Windows
   stego_env\Scripts\activate
   
   # macOS/Linux
   source stego_env/bin/activate
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

### Running the Service

#### Development Mode
```bash
# Start with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Service available at:
# - API: http://localhost:8000
# - Docs: http://localhost:8000/docs
# - Redoc: http://localhost:8000/redoc
```

#### Production Mode
```bash
# Start production server
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Or use the exact command from existing README
uvicorn main:app --host 0.0.0.0 --port 8001
```

## 📦 Dependencies

### Core Requirements (requirements.txt)
```txt
fastapi>=0.68.0
uvicorn>=0.15.0
python-multipart>=0.0.5
Pillow>=8.3.0
opencv-python>=4.5.0
pytesseract>=0.3.8
numpy>=1.21.0
scikit-image>=0.18.0
scipy>=1.7.0
matplotlib>=3.4.0
python-magic>=0.4.24
aiofiles>=0.7.0
pydantic>=1.8.0
```

### Optional Dependencies
```txt
# For enhanced image processing
imageio>=2.9.0
skimage>=0.18.0

# For advanced statistical analysis
pandas>=1.3.0
scikit-learn>=1.0.0

# For deep learning models (future)
tensorflow>=2.6.0
torch>=1.9.0
```

## 🔌 API Endpoints

### Health Check
```http
GET /health
```
Returns service health status and system information.

**Response:**
```json
{
  "status": "healthy",
  "service": "StegnoShield",
  "version": "1.0.0",
  "tesseract_version": "4.1.1",
  "opencv_version": "4.5.3"
}
```

### Image Analysis
```http
POST /analyze
```
Analyze an image for steganographic content.

**Request (multipart/form-data):**
```http
Content-Type: multipart/form-data

file: <image_file>
options: {
  "detect_lsb": true,
  "detect_dct": true,
  "extract_text": true,
  "analyze_metadata": true,
  "statistical_analysis": true
}
```

**Response:**
```json
{
  "success": true,
  "filename": "test_image.png",
  "file_size": 45623,
  "image_dimensions": [800, 600],
  "analysis_results": {
    "steganography_detected": true,
    "confidence_score": 0.85,
    "techniques_detected": ["LSB", "DCT"],
    "suspicious_regions": [
      {
        "method": "LSB",
        "confidence": 0.89,
        "region": [100, 150, 200, 250]
      }
    ],
    "extracted_text": "Hidden message found",
    "metadata": {
      "camera_model": "Canon EOS R5",
      "gps_coordinates": null,
      "creation_date": "2023-10-15T14:30:00"
    },
    "statistical_anomalies": {
      "chi_square_p_value": 0.001,
      "histogram_irregularities": true
    }
  },
  "processing_time_ms": 1250
}
```

### Batch Analysis
```http
POST /analyze/batch
```
Process multiple images in a single request.

**Request:**
```http
Content-Type: multipart/form-data

files: <multiple_image_files>
options: <analysis_options>
```

## 🔍 Detection Algorithms

### 1. LSB (Least Significant Bit) Detection
```python
class LSBDetector:
    def detect(self, image):
        """Detect LSB steganography in image"""
        # Extract LSB planes
        lsb_planes = self.extract_lsb_planes(image)
        
        # Statistical analysis
        entropy = self.calculate_entropy(lsb_planes)
        chi_square = self.chi_square_test(lsb_planes)
        
        return {
            'detected': entropy > self.entropy_threshold,
            'confidence': self.calculate_confidence(entropy, chi_square),
            'method': 'LSB'
        }
```

### 2. DCT (Discrete Cosine Transform) Detection
```python
class DCTDetector:
    def detect(self, image):
        """Detect DCT-based steganography"""
        # Apply DCT transform
        dct_coefficients = self.apply_dct(image)
        
        # Analyze coefficient patterns
        irregularities = self.detect_coefficient_irregularities(dct_coefficients)
        
        return {
            'detected': len(irregularities) > self.threshold,
            'confidence': self.calculate_dct_confidence(irregularities),
            'method': 'DCT'
        }
```

### 3. Statistical Analysis
```python
class StatisticalDetector:
    def analyze(self, image):
        """Perform statistical analysis for steganography detection"""
        
        # Chi-square test
        chi_square_p = self.chi_square_test(image)
        
        # Histogram analysis
        hist_irregularities = self.analyze_histogram(image)
        
        # Pair analysis
        pair_analysis = self.sample_pair_analysis(image)
        
        return {
            'chi_square_p_value': chi_square_p,
            'histogram_suspicious': hist_irregularities,
            'pair_analysis_result': pair_analysis
        }
```

## 🖼️ Image Processing Features

### Supported Formats
- **Raster Images**: PNG, JPEG, BMP, TIFF, GIF
- **Raw Formats**: CR2, NEF, ARW (via additional libraries)
- **Vector Graphics**: SVG (limited analysis)

### Processing Capabilities
- **Format Conversion**: Automatic format handling
- **Size Optimization**: Reduce processing time for large images
- **Color Space Analysis**: RGB, CMYK, Grayscale processing
- **Compression Analysis**: Detect recompression artifacts

## 📊 OCR Text Extraction

### Tesseract Configuration
```python
# OCR configuration
tesseract_config = {
    'lang': 'eng',  # Language
    'oem': 3,       # OCR Engine Mode
    'psm': 6,       # Page Segmentation Mode
    'config': '--tessdata-dir /usr/share/tesseract-ocr'
}
```

### Text Extraction Process
1. **Preprocessing**: Image enhancement for better OCR
2. **Text Detection**: Identify text regions
3. **Character Recognition**: Extract text content
4. **Post-processing**: Clean and validate extracted text
5. **Confidence Scoring**: Assess extraction reliability

## 🔧 Configuration

### Environment Variables
```env
# Service Configuration
STEGO_PORT=8000
STEGO_HOST=0.0.0.0
STEGO_WORKERS=4

# Processing Limits
MAX_FILE_SIZE=50MB
MAX_BATCH_SIZE=10
PROCESSING_TIMEOUT=30

# Tesseract Configuration
TESSERACT_PATH=/usr/bin/tesseract
TESSDATA_PREFIX=/usr/share/tesseract-ocr

# Detection Thresholds
LSB_ENTROPY_THRESHOLD=7.8
DCT_IRREGULARITY_THRESHOLD=0.05
CHI_SQUARE_P_THRESHOLD=0.01
```

### Service Configuration
```python
# main.py configuration
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="StegnoShield API",
    description="Steganography Detection and Analysis Service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 🐳 Docker Deployment

### Dockerfile
```dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  stegoshield:
    build: .
    ports:
      - "8000:8000"
    environment:
      - STEGO_PORT=8000
      - STEGO_HOST=0.0.0.0
    volumes:
      - ./temp:/app/temp
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Running with Docker
```bash
# Build image
docker build -t stegoshield .

# Run container
docker run -p 8000:8000 stegoshield

# Or use docker-compose
docker-compose up -d
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test categories
pytest tests/test_steganography.py
pytest tests/test_api.py
```

### API Testing
```python
# Example test
import requests

def test_analyze_endpoint():
    url = "http://localhost:8000/analyze"
    
    with open("test_image.png", "rb") as f:
        files = {"file": f}
        response = requests.post(url, files=files)
    
    assert response.status_code == 200
    assert response.json()["success"] == True
```

### Performance Testing
```bash
# Load testing with multiple requests
python -m pytest tests/test_performance.py

# Memory usage monitoring
python -m memory_profiler main.py
```

## 📈 Performance Optimization

### Processing Optimizations
- **Image Resizing**: Reduce large images for faster processing
- **Parallel Processing**: Utilize multiple CPU cores
- **Caching**: Cache processing results for similar images
- **Batch Processing**: Process multiple images efficiently

### Memory Management
```python
# Efficient memory usage
import gc
from PIL import Image

def process_image(image_path):
    with Image.open(image_path) as img:
        # Process image
        result = analyze_steganography(img)
    
    # Force garbage collection
    gc.collect()
    
    return result
```

## 🔗 Integration with ThreatPeek Components

### Backend Integration
The Node.js backend forwards requests to StegnoShield:

```javascript
// Backend integration example
app.post('/api/stegoshield/analyze', async (req, res) => {
    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);
        
        const response = await axios.post(
            `${process.env.STEGOSHIELD_URL}/analyze`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    ...formData.getHeaders()
                }
            }
        );
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Browser Extension Integration
Direct API calls from the browser extension:

```javascript
// Extension integration
async function analyzeImage(imageBlob) {
    const formData = new FormData();
    formData.append('file', imageBlob, 'image.png');
    
    const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData
    });
    
    return await response.json();
}
```

## 🔮 Future Enhancements

- [ ] **Deep Learning Models**: CNN-based steganography detection
- [ ] **Video Analysis**: Steganography detection in video files
- [ ] **Audio Steganography**: Support for audio file analysis
- [ ] **Blockchain Integration**: Immutable analysis records
- [ ] **Real-time Processing**: WebSocket-based streaming analysis
- [ ] **Cloud Storage**: Integration with cloud storage services
- [ ] **Advanced Forensics**: Detailed forensic analysis capabilities
- [ ] **Machine Learning Pipeline**: Automated model retraining

## 🛟 Troubleshooting

### Common Issues

**Tesseract Not Found**
```bash
# Install Tesseract
sudo apt-get install tesseract-ocr

# Or specify path in environment
export TESSERACT_PATH=/usr/local/bin/tesseract
```

**Memory Issues with Large Images**
```python
# Resize large images before processing
def resize_if_large(image, max_size=2048):
    if max(image.size) > max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return image
```

**Performance Issues**
- Enable multi-threading for batch processing
- Implement image caching for repeated analysis
- Use appropriate image formats (PNG vs JPEG)

## 🤝 Contributing

1. Follow PEP 8 style guidelines
2. Add unit tests for new detection algorithms
3. Document API changes in OpenAPI schema
4. Test with various image formats and sizes
5. Consider performance impact of new features

---

For detailed API documentation, visit the automatically generated docs at `/docs` when the service is running.
