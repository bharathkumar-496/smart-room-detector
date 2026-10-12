# Smart Room Proctor AI - Smartphone & Malpractice Detection

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://smart-room-detector.vercel.app)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)

🔗 **Live URL**: [https://smart-room-detector.vercel.app](https://smart-room-detector.vercel.app)

A modern, high-tech Web Application powered by **Google Teachable Machine** and **TensorFlow.js** designed for smart room monitoring, exam hall proctoring, and automated malpractice detection (smartphone detection with auto-absent tagging).

---

## 🎯 Features

- **Pre-configured Model**: Embedded with your trained Teachable Machine model (`https://teachablemachine.withgoogle.com/models/FZ36RgbjB/`).
- **Student Roster Proctoring**:
  - Automatically identifies student IDs: `44733003`, `44733010`, `44733013`.
  - Distinguishes **Present** from **Smartphone Malpractice Detected**.
  - Automatically marks students **ABSENT** when smartphone malpractice is detected.
- **Dual Visual Input Modes**:
  - 📸 **Photo Inspection Mode**: Drag and drop or upload exam hall / student photos for instant batch evaluation.
  - 📹 **Live Webcam Surveillance**: Continuous real-time video inference with smooth FPS counter and scanning reticle.
- **Smart Room Automation Simulator**:
  - Real-time room security status: `NORMAL` vs `ALERT: MALPRACTICE`.
  - Audio warning siren (Web Audio API synth - zero external assets required).
  - Configurable sensitivity / detection confidence threshold slider.
- **Audit Logging & Report Export**:
  - Live activity log of all detections and timestamped incidents.
  - 1-click **Export CSV** for proctoring attendance and malpractice records.

---

## 🚀 Running Locally (Mac / Linux / Windows)

Open Terminal in this directory:
```bash
cd /Users/bharathkumar/.gemini/antigravity/scratch/smart-room-detector
```

Launch a lightweight local server:
```bash
python3 -m http.server 8080
```
Then open your browser to **`http://localhost:8080`**.

---

## 🌐 How to Deploy to a Beautiful Live Website (Free)

Because this web app runs 100% in the browser (client-side TensorFlow.js), it has **no server or database maintenance costs**. You can deploy it for free in under 2 minutes using any of the following methods:

### Option 1: Vercel (Fastest - Recommended)

1. Open your terminal in the project directory:
   ```bash
   cd /Users/bharathkumar/.gemini/antigravity/scratch/smart-room-detector
   ```
2. Run Vercel's instant deploy tool:
   ```bash
   npx vercel
   ```
3. Follow the prompts (login with GitHub or email). Keep default settings by pressing Enter.
4. Done! You will get a live HTTPS URL (e.g. `https://smart-room-detector.vercel.app`).
   *(HTTPS is required by browsers to allow webcam access).*

---

### Option 2: Netlify Drop (Zero Terminal / Drag & Drop)

1. Visit [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop the `smart-room-detector` folder directly into the Netlify Drop box in your browser.
3. Your website will be live in 10 seconds with a free `.netlify.app` domain!

---

### Option 3: GitHub Pages (Permanent Free Hosting)

1. Create a new repository on GitHub (e.g., `smart-room-detector`).
2. Push this folder to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Smart Room Proctor AI"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-room-detector.git
   git push -u origin main
   ```
3. In GitHub, navigate to **Settings** → **Pages**.
4. Under **Branch**, select `main` and click **Save**.
5. Your site is now live at `https://YOUR_USERNAME.github.io/smart-room-detector/`!

---

## ⚙️ Changing or Retraining Models

If you retrain your model in Teachable Machine:
1. Click **Export Model** in Teachable Machine.
2. Select **TensorFlow.js** → **Upload my model**.
3. Copy the sharable URL.
4. Click the ⚙️ **Settings icon** in the top right of this web dashboard and paste your new link. It will automatically re-render all classes!
