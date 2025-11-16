"""
Quick camera test to find available cameras
"""
import cv2

print("Testing available cameras...")
print("-" * 50)

for i in range(5):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret:
            print(f"✅ Camera {i} works! Resolution: {frame.shape[1]}x{frame.shape[0]}")
        else:
            print(f"⚠️  Camera {i} opened but can't read frames")
        cap.release()
    else:
        print(f"❌ Camera {i} not available")

print("-" * 50)
print("\nIf no cameras work, check:")
print("1. Is your webcam connected?")
print("2. Are camera permissions enabled in System Preferences?")
print("3. Is another app using the camera?")
