"""
Gesture Model Training Script
==============================
This script trains a machine learning classifier on your collected gesture data.

Requirements:
- gesture_training_data.csv (created by collect_gesture_data.py)
- scikit-learn (will be installed if needed)

Usage:
1. Collect data using collect_gesture_data.py
2. Run: python3 train_gesture_model.py
3. The trained model will be saved as 'gesture_model.pkl'
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import pickle
import os

def train_model():
    print("\n" + "="*60)
    print("GESTURE MODEL TRAINING")
    print("="*60 + "\n")
    
    # Load data
    data_file = 'gesture_training_data.csv'
    if not os.path.exists(data_file):
        print(f"❌ Error: {data_file} not found!")
        print("Please run collect_gesture_data.py first to collect training data.")
        return
    
    print(f"📂 Loading data from {data_file}...")
    df = pd.read_csv(data_file)
    
    # Check data quality
    print(f"\n📊 Dataset Info:")
    print(f"   Total samples: {len(df)}")
    print(f"\n   Samples per gesture:")
    for gesture, count in df['gesture'].value_counts().items():
        print(f"      {gesture}: {count}")
    
    # Prepare features and labels
    X = df.iloc[:, :-1].values  # All columns except last (landmark coordinates)
    y = df.iloc[:, -1].values   # Last column (gesture labels)
    
    # Split data: 80% training, 20% testing
    print(f"\n✂️  Splitting data (80% train, 20% test)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"   Training samples: {len(X_train)}")
    print(f"   Testing samples: {len(X_test)}")
    
    # Train Random Forest Classifier
    print(f"\n🌲 Training Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate
    print(f"\n📈 Evaluating model...")
    train_accuracy = model.score(X_train, y_train)
    test_accuracy = model.score(X_test, y_test)
    
    print(f"\n   Training Accuracy: {train_accuracy*100:.2f}%")
    print(f"   Testing Accuracy: {test_accuracy*100:.2f}%")
    
    # Detailed metrics
    y_pred = model.predict(X_test)
    print(f"\n📊 Classification Report:")
    print(classification_report(y_test, y_pred))
    
    print(f"\n🔢 Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Save model
    model_file = 'gesture_model.pkl'
    print(f"\n💾 Saving model to {model_file}...")
    with open(model_file, 'wb') as f:
        pickle.dump(model, f)
    
    # Save gesture labels for reference
    labels_file = 'gesture_labels.pkl'
    unique_labels = sorted(df['gesture'].unique())
    with open(labels_file, 'wb') as f:
        pickle.dump(unique_labels, f)
    
    print(f"\n" + "="*60)
    print("✅ TRAINING COMPLETE!")
    print("="*60)
    print(f"\nModel saved to: {model_file}")
    print(f"Labels saved to: {labels_file}")
    print(f"\nNext step: Update archmage_cv.py to use the trained model")
    print("="*60 + "\n")


if __name__ == '__main__':
    try:
        train_model()
    except ImportError as e:
        if 'sklearn' in str(e):
            print("\n❌ scikit-learn not installed!")
            print("Installing scikit-learn...")
            import subprocess
            subprocess.check_call(['pip', 'install', 'scikit-learn', 'pandas'])
            print("\n✅ Installation complete! Please run this script again.")
        else:
            raise
