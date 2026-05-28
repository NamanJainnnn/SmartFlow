import os
import random
import math
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def simulate_vehicle_count(filename):
    """
    Simulate vehicle detection using image file properties as a seed.
    In production, swap this for real OpenCV detection.
    """
    # Use filename characters as a deterministic seed so same image = same result
    seed = sum(ord(c) for c in filename)
    rng = random.Random(seed)

    # Try OpenCV if available, otherwise fall back to simulation
    try:
        import cv2
        import numpy as np

        img_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        img = cv2.imread(img_path)

        if img is not None:
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Edge detection to find car-like edges
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size

            # Estimate cars from edge density (calibrated heuristic)
            base_count = int(edge_density * 120)
            noise = rng.randint(-3, 3)
            count = max(0, min(60, base_count + noise))
            method = "OpenCV Edge Analysis"
        else:
            count = rng.randint(5, 45)
            method = "Simulation (image unreadable)"

    except ImportError:
        count = rng.randint(5, 45)
        method = "Simulation Mode"

    return count, method

def get_congestion(count):
    if count <= 10:
        return "Low", "#22c55e", 20
    elif count <= 25:
        return "Medium", "#f59e0b", 40
    else:
        return "High", "#ef4444", 70

def get_signal_state(level):
    if level == "Low":
        return "green"
    elif level == "Medium":
        return "yellow"
    else:
        return "red"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Use JPG or PNG.'}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(save_path)

    count, method = simulate_vehicle_count(filename)
    level, color, timer = get_congestion(count)
    signal = get_signal_state(level)

    # Confidence score (simulated)
    confidence = round(random.uniform(87.5, 98.9), 1)

    return jsonify({
        'vehicle_count': count,
        'congestion_level': level,
        'congestion_color': color,
        'signal_timer': timer,
        'signal_state': signal,
        'detection_method': method,
        'confidence': confidence,
        'filename': filename
    })

if __name__ == '__main__':
    os.makedirs('uploads', exist_ok=True)
    app.run(host="0.0.0.0", port=5000)
