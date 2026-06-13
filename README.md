# Single Dish AR Menu - Signature Craft Burger

A premium WebAR menu experience that allows restaurant customers to scan a QR code, open a landing page with a 3D preview of the Signature Craft Burger, and place it at exactly 1:1 real-world scale on their table using Augmented Reality.

Built with **Three.js** and the native **WebXR Device API (with DOM Overlay)**. No mobile app installations or plugins are required.

---

## Features

- **Premium Restaurant UI**: Sleek, mobile-first design with clean off-white background, custom typography, gold/bronze branding, and interactive ingredients badges.
- **3D Interactive Preview**: A fully interactive 3D model preview on the landing page, powered by `OrbitControls`, enabling customers to spin and zoom on the burger before entering AR.
- **Realistic lighting**: Tailored PBR lights and soft shadow maps configured specifically for food textures to make the burger look fresh, juicy, and appetizing.
- **Native WebXR AR Mode**: Uses Google ARCore's horizontal plane detection. A custom 3D reticle aligns to flat surfaces like tables.
- **Dynamic Shadows in AR**: An invisible shadow-catching plane sits beneath the placed burger, casting a realistic ambient shadow on the real-world table to ground the object.
- **Custom Touch Gestures with Safety Limits**:
  - **Single Finger Drag**: Rotates the burger smoothly on its Y-axis (`rotation.y`).
  - **Two-Finger Pinch**: Scales the burger relative to its real size. Includes **strict safety limits** preventing scaling smaller than **0.8x** or larger than **1.5x** to preserve real-world size context.
  - **Tap-to-Reposition**: Tapping another spot on the detected surface moves the burger to the new location.
  - **Reset Controls**: A sleek glassmorphic HUD button appears if the model is rotated or scaled, allowing the customer to snap it back to 100% scale and default orientation in one click.

---

## File Structure

```
burger-ar-menu/
├── public/
│   └── Burger.glb              # The 3D PBR burger model (78.3 MB)
├── index.html                  # Landing page structure & WebXR overlay HUD
├── main.js                     # Three.js engine & WebXR AR gesture controller
├── styles.css                  # Clean, luxury restaurant aesthetics & animation tokens
├── vercel.json                 # Vercel deployment configuration (caching and CORS)
├── generate_qr.py              # Dependency-free Python script to generate a menu QR code
└── menu-qr.png                 # The generated QR code image file for printing
```

---

## Local Development and Testing

Since WebXR has security requirements, please review the steps below to test the AR features.

### Step 1: Run a Local Server
You can run a local server using Python (which is built-in and requires zero installation). Open your command prompt, navigate to the `burger-ar-menu` directory, and run:

```bash
python -m http.server 8000
```

This will host the website at `http://localhost:8000`.

### Step 2: Testing the 3D Preview (Desktop or Mobile)
Open your browser and navigate to `http://localhost:8000`. You will see the loading screen and then the interactive 3D burger rotating on the landing page.

### Step 3: Testing AR Mode (WebXR Security Guidelines)
WebXR requires a **Secure Context** (HTTPS or `localhost`) to access the device's camera and sensors. To test AR mode on a physical phone:

1. **Option A: Vercel Deployment (Recommended)**
   Deploy the project to Vercel (see instructions below). Vercel provides a secure `https://` domain automatically. Once deployed, open the page on your Android phone to enter AR.
2. **Option B: Chrome Port Forwarding**
   If you want to test local changes in real time on a physical device:
   - Connect your Android phone to your PC via a USB cable.
   - On your phone, enable **USB Debugging** (in developer options).
   - On your PC, open Chrome and go to `chrome://inspect`.
   - Click **Port forwarding...** and add a rule: Port `8000` maps to `localhost:8000`.
   - Open Chrome on your Android phone and navigate to `http://localhost:8000`. The browser will treat it as secure `localhost` and WebXR AR will launch successfully!

---

## Vercel Deployment

Deploying the project is simple and does not require Node.js, NPM, or Git.

### Option A: Drag-and-Drop (easiest)
1. Go to the [Vercel Dashboard](https://vercel.com) and log in.
2. Under your account dashboard, click **Add New...** -> **Project**.
3. Under the upload area, find the **Drag and Drop** section.
4. Drag the entire `burger-ar-menu` folder and drop it.
5. Vercel will upload the folder and deploy it as a static site. You will receive a secure `https://...` deployment URL!

### Option B: Deploy via GitHub
1. Initialize a Git repository inside the `burger-ar-menu` folder, commit the files, and push them to a GitHub repository.
2. In the Vercel dashboard, click **Add New...** -> **Project** -> **Import** your GitHub repository.
3. Keep default settings and click **Deploy**.

---

## Generating Your Custom QR Code

Once you deploy your project to Vercel, you will get a production URL (for example, `https://your-burger-menu.vercel.app`). You can update the QR code to point to your new URL by running the included helper script.

Run this command in your terminal:

```bash
python generate_qr.py https://your-burger-menu.vercel.app
```

This script will download a new `menu-qr.png` file directly from a secure API. You can import this image file into your restaurant's design software to print it inside menus.

---

## Instructions for Future Dishes (Asset Replacement)

To update the 3D model or add new dishes to this AR menu:

1. **Replace the GLB File**:
   - Place your new 3D model in the `public/` directory (e.g., `public/Pizza.glb`).
   - *Note*: Ensure your model is exported in GLB format and is **optimized** (aim for under 15MB if possible; the provided burger is highly detailed at 78MB, but smaller file sizes load much faster on mobile cellular networks).

2. **Update the Loading Path**:
   - Open `main.js`.
   - Locate the `loadBurgerModel()` function:
     ```javascript
     loader.load('./public/Burger.glb', (gltf) => { ... })
     ```
   - Change `./public/Burger.glb` to your new filename.

3. **Check Bounding Scale (Important)**:
   - In glTF/Three.js, 1 unit equals **1 meter**.
   - Make sure your new model is scaled correctly in your 3D modeling software (like Blender) before exporting:
     - A burger should be roughly `0.11` units wide (11 cm).
     - A pizza should be roughly `0.30` units wide (30 cm).
     - A drink glass should be roughly `0.15` units tall (15 cm).
   - If the model is not modeled at real scale, you can apply a correction factor inside `main.js` inside the loader success callback by setting:
     ```javascript
     burgerModel.scale.set(correctionFactor, correctionFactor, correctionFactor);
     ```

4. **Adjust Landing Page Camera**:
   - If the new model is much larger or smaller, you can adjust the camera distance on the landing page preview in `main.js` (line 44):
     ```javascript
     previewCamera.position.set(0, 0.15, 0.3); // X, Y, Z camera coordinates
     ```
