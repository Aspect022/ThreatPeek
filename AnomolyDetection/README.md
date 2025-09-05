# ThreatPeek Anomaly Detection System 🤖

Advanced machine learning-based anomaly detection system using Random Forest and Isolation Forest algorithms for cybersecurity threat identification and classification.

## 🎯 Overview

The Anomaly Detection System is the core machine learning component of ThreatPeek, providing:

- **Intelligent Threat Detection**: ML-powered anomaly identification
- **Multi-Algorithm Approach**: Random Forest and Isolation Forest models
- **Data Preprocessing**: Comprehensive feature engineering pipeline
- **Model Evaluation**: Performance metrics and validation
- **Scalable Architecture**: Designed for high-volume data processing
- **Confidence Scoring**: Threat probability assessment

## 🛠️ Technology Stack

- **Language**: Python 3.8+
- **ML Framework**: Scikit-learn
- **Data Processing**: Pandas, NumPy
- **Visualization**: Matplotlib, Seaborn
- **Development**: Jupyter Notebooks
- **Model Persistence**: Joblib/Pickle

## 📊 Machine Learning Models

### Random Forest Classifier
- **Purpose**: Supervised anomaly classification
- **Features**: Ensemble learning, feature importance ranking
- **Use Cases**: Labeled threat data classification
- **Advantages**: High accuracy, interpretability, robustness

### Isolation Forest
- **Purpose**: Unsupervised anomaly detection
- **Features**: Outlier detection, no labeled data required
- **Use Cases**: Novel threat discovery, zero-day detection
- **Advantages**: Efficient with high-dimensional data

## 📁 Directory Structure

```
AnomolyDetection/
├── 📄 anomalydetection1 (1).ipynb    # Main analysis notebook
├── 📂 Models/                        # Trained model files
│   ├── 📄 random_forest_model.pkl   # Trained Random Forest model
│   ├── 📄 isolation_forest_model.pkl # Trained Isolation Forest model
│   ├── 📄 scaler.pkl                # Feature scaler
│   └── 📄 label_encoder.pkl         # Categorical encoder
├── 📂 data/                         # Training and test datasets
│   ├── 📄 training_data.csv         # Model training data
│   ├── 📄 test_data.csv             # Model testing data
│   └── 📄 validation_data.csv       # Model validation data
├── 📂 scripts/                      # Automation scripts
│   ├── 📄 train_models.py           # Model training script
│   ├── 📄 predict.py               # Prediction script
│   └── 📄 evaluate.py              # Model evaluation script
└── 📂 utils/                       # Utility functions
    ├── 📄 preprocessing.py         # Data preprocessing utilities
    ├── 📄 feature_engineering.py   # Feature engineering functions
    └── 📄 visualization.py         # Plotting and visualization
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- Jupyter Notebook
- Required Python packages (see requirements.txt)

### Installation

1. **Navigate to AnomolyDetection directory**
   ```bash
   cd AnomolyDetection
   ```

2. **Create virtual environment** (recommended)
   ```bash
   python -m venv anomaly_detection_env
   
   # Windows
   anomaly_detection_env\Scripts\activate
   
   # macOS/Linux
   source anomaly_detection_env/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

### Requirements.txt
```txt
pandas>=1.3.0
numpy>=1.21.0
scikit-learn>=1.0.0
matplotlib>=3.4.0
seaborn>=0.11.0
jupyter>=1.0.0
joblib>=1.1.0
plotly>=5.0.0
```

### Running the Analysis

1. **Start Jupyter Notebook**
   ```bash
   jupyter notebook
   ```

2. **Open the main notebook**
   ```
   anomalydetection1 (1).ipynb
   ```

3. **Run all cells** or execute step by step

## 📓 Notebook Structure

### 1. Library Installation & Import
```python
# Essential libraries for machine learning pipeline
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
```

### 2. Data Loading & Exploration
- **Data Import**: Load datasets from various sources
- **Initial Inspection**: Shape, data types, missing values
- **Statistical Summary**: Descriptive statistics
- **Data Quality Assessment**: Completeness and consistency

### 3. Exploratory Data Analysis (EDA)
- **Distribution Analysis**: Feature value distributions
- **Correlation Analysis**: Feature relationships
- **Anomaly Visualization**: Initial anomaly patterns
- **Class Distribution**: Label balance analysis

### 4. Data Preprocessing
```python
# Feature scaling and normalization
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Categorical encoding
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)
```

### 5. Feature Engineering
- **Categorical Features**: One-hot encoding, label encoding
- **Numerical Features**: Scaling, normalization
- **Feature Selection**: Importance-based selection
- **Dimensionality Reduction**: PCA if needed

### 6. Model Training & Evaluation

#### Random Forest Training
```python
# Random Forest Classifier
rf_classifier = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    n_jobs=-1
)

rf_classifier.fit(X_train, y_train)
rf_predictions = rf_classifier.predict(X_test)
```

#### Isolation Forest Training
```python
# Isolation Forest for anomaly detection
isolation_forest = IsolationForest(
    contamination=0.1,
    random_state=42,
    n_jobs=-1
)

isolation_forest.fit(X_train)
anomaly_scores = isolation_forest.decision_function(X_test)
```

### 7. Model Performance Evaluation
- **Classification Metrics**: Accuracy, Precision, Recall, F1-score
- **Confusion Matrix**: True/False positives and negatives
- **ROC Curve**: Receiver Operating Characteristic analysis
- **Feature Importance**: Model interpretability

### 8. Results Visualization
- **Performance Plots**: Accuracy and loss curves
- **Feature Importance Charts**: Model decision factors
- **Anomaly Distribution**: Detection results visualization
- **Confusion Matrix Heatmaps**: Classification performance

## 🔧 Model Configuration

### Random Forest Parameters
```python
rf_params = {
    'n_estimators': 100,          # Number of trees
    'max_depth': 10,              # Maximum tree depth
    'min_samples_split': 2,       # Minimum samples to split
    'min_samples_leaf': 1,        # Minimum samples in leaf
    'random_state': 42,           # Reproducibility
    'n_jobs': -1                  # Parallel processing
}
```

### Isolation Forest Parameters
```python
isolation_params = {
    'contamination': 0.1,         # Expected anomaly proportion
    'n_estimators': 100,          # Number of base estimators
    'max_samples': 'auto',        # Samples per base estimator
    'random_state': 42,           # Reproducibility
    'n_jobs': -1                  # Parallel processing
}
```

## 📈 Performance Metrics

### Classification Metrics
- **Accuracy**: Overall correct predictions percentage
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1-Score**: Harmonic mean of precision and recall
- **AUC-ROC**: Area under the ROC curve

### Anomaly Detection Metrics
- **Anomaly Score**: Model confidence in anomaly detection
- **Contamination Rate**: Proportion of anomalies detected
- **False Positive Rate**: Normal data misclassified as anomalies
- **Detection Rate**: True anomalies correctly identified

## 🔄 Model Integration

### API Integration
```python
# Model prediction function for API integration
def predict_anomaly(data):
    """
    Predict anomalies in input data
    
    Args:
        data: Input features for prediction
    
    Returns:
        dict: Prediction results with confidence scores
    """
    # Preprocess data
    data_scaled = scaler.transform(data)
    
    # Random Forest prediction
    rf_prediction = rf_classifier.predict(data_scaled)
    rf_probability = rf_classifier.predict_proba(data_scaled)
    
    # Isolation Forest prediction
    anomaly_score = isolation_forest.decision_function(data_scaled)
    anomaly_prediction = isolation_forest.predict(data_scaled)
    
    return {
        'rf_prediction': rf_prediction.tolist(),
        'rf_confidence': rf_probability.max(axis=1).tolist(),
        'anomaly_score': anomaly_score.tolist(),
        'is_anomaly': (anomaly_prediction == -1).tolist()
    }
```

### Model Persistence
```python
# Save trained models
import joblib

# Save models and preprocessors
joblib.dump(rf_classifier, 'Models/random_forest_model.pkl')
joblib.dump(isolation_forest, 'Models/isolation_forest_model.pkl')
joblib.dump(scaler, 'Models/scaler.pkl')
joblib.dump(label_encoder, 'Models/label_encoder.pkl')

# Load models for prediction
rf_model = joblib.load('Models/random_forest_model.pkl')
isolation_model = joblib.load('Models/isolation_forest_model.pkl')
```

## 🧪 Testing & Validation

### Cross-Validation
```python
from sklearn.model_selection import cross_val_score

# K-fold cross-validation
cv_scores = cross_val_score(
    rf_classifier, X_train, y_train, 
    cv=5, scoring='accuracy'
)

print(f"Cross-validation scores: {cv_scores}")
print(f"Mean CV accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std() * 2:.3f})")
```

### Model Validation
```python
# Validation on separate dataset
def validate_model(model, X_val, y_val):
    """Validate model performance on validation set"""
    val_predictions = model.predict(X_val)
    val_accuracy = accuracy_score(y_val, val_predictions)
    val_report = classification_report(y_val, val_predictions)
    
    return val_accuracy, val_report
```

## 📊 Data Pipeline

### Data Sources
- **Network Traffic**: Connection logs, packet analysis
- **System Logs**: Application and system events
- **User Behavior**: Access patterns, activity logs
- **External Feeds**: Threat intelligence data
- **Custom Metrics**: Application-specific indicators

### Feature Engineering Pipeline
```python
def preprocess_pipeline(raw_data):
    """Complete preprocessing pipeline"""
    
    # 1. Data cleaning
    cleaned_data = clean_data(raw_data)
    
    # 2. Feature extraction
    features = extract_features(cleaned_data)
    
    # 3. Categorical encoding
    encoded_features = encode_categorical(features)
    
    # 4. Scaling
    scaled_features = scale_features(encoded_features)
    
    return scaled_features
```

## 🔍 Model Interpretation

### Feature Importance Analysis
```python
# Random Forest feature importance
feature_importance = pd.DataFrame({
    'feature': feature_names,
    'importance': rf_classifier.feature_importances_
}).sort_values('importance', ascending=False)

# Plot feature importance
plt.figure(figsize=(10, 8))
sns.barplot(data=feature_importance.head(20), x='importance', y='feature')
plt.title('Top 20 Feature Importance - Random Forest')
plt.show()
```

### Model Explanability
- **SHAP Values**: Individual prediction explanations
- **LIME**: Local interpretable model explanations
- **Permutation Importance**: Feature impact analysis
- **Partial Dependence**: Feature effect visualization

## 🚀 Deployment & Production

### Model Serving
```python
# Flask API for model serving
from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

# Load models
rf_model = joblib.load('Models/random_forest_model.pkl')
isolation_model = joblib.load('Models/isolation_forest_model.pkl')
scaler = joblib.load('Models/scaler.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    features = preprocess_data(data)
    prediction = predict_anomaly(features)
    return jsonify(prediction)
```

### Batch Processing
```python
# Batch prediction script
def batch_predict(input_file, output_file):
    """Process large datasets in batches"""
    
    # Read data in chunks
    chunk_size = 10000
    predictions = []
    
    for chunk in pd.read_csv(input_file, chunksize=chunk_size):
        chunk_predictions = predict_anomaly(chunk)
        predictions.extend(chunk_predictions)
    
    # Save results
    pd.DataFrame(predictions).to_csv(output_file, index=False)
```

## 📈 Monitoring & Maintenance

### Model Performance Monitoring
- **Accuracy Tracking**: Monitor prediction accuracy over time
- **Data Drift Detection**: Identify changes in data distribution
- **Model Degradation**: Track performance decline
- **Retraining Triggers**: Automated model updates

### Alerting System Integration
```python
# Integration with alerting system
def send_anomaly_alert(prediction_results):
    """Send alerts for high-confidence anomalies"""
    
    for result in prediction_results:
        if result['anomaly_score'] < -0.5:  # High anomaly score
            alert_data = {
                'timestamp': datetime.now().isoformat(),
                'anomaly_score': result['anomaly_score'],
                'confidence': result['rf_confidence'],
                'features': result['features']
            }
            
            # Send to automation system
            send_to_n8n_webhook(alert_data)
```

## 🔮 Future Enhancements

- [ ] **Deep Learning Models**: Neural networks for complex patterns
- [ ] **Real-time Processing**: Streaming anomaly detection
- [ ] **AutoML Integration**: Automated model selection and tuning
- [ ] **Ensemble Methods**: Combine multiple algorithms
- [ ] **Federated Learning**: Distributed model training
- [ ] **Explainable AI**: Enhanced model interpretability
- [ ] **Online Learning**: Adaptive models with continuous learning
- [ ] **GPU Acceleration**: High-performance computing integration

## 🛟 Troubleshooting

### Common Issues

**Memory Issues with Large Datasets**
```python
# Use data chunking for large datasets
def process_large_dataset(file_path, chunk_size=10000):
    results = []
    for chunk in pd.read_csv(file_path, chunksize=chunk_size):
        processed_chunk = preprocess_pipeline(chunk)
        chunk_results = model.predict(processed_chunk)
        results.extend(chunk_results)
    return results
```

**Model Performance Degradation**
```python
# Regular model evaluation
def evaluate_model_performance():
    """Monitor model performance and trigger retraining if needed"""
    current_accuracy = evaluate_current_model()
    
    if current_accuracy < PERFORMANCE_THRESHOLD:
        trigger_model_retraining()
        send_performance_alert()
```

## 🤝 Contributing

1. Follow scientific computing best practices
2. Document all experiments and results
3. Use version control for notebooks (consider nbstripout)
4. Add unit tests for utility functions
5. Maintain reproducible results with random seeds

---

For questions about the machine learning models or data science approach, refer to the main project documentation or consult the notebook comments for detailed explanations.
