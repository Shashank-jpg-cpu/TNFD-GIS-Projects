# Live Session App

A lightweight, independent WebRTC live video session web application designed for mobile phones and desktop computers.

## ✨ Features

- **No App Store / APK Required:** Runs entirely in the web browser (Chrome, Safari, Edge, WhatsApp in-app browser).
- **Host Dashboard:**
  - Create sessions with custom titles.
  - One-click **"Share via WhatsApp"** pre-formatted invite.
  - One-click **"Copy Link"**.
  - **Session History & Recording Vault:**
    - Automatically logs every hosted session: Date, Start Time, End Time, and Duration (hours & minutes).
    - Preserves recorded video files on the Host's device (IndexedDB) with an instant **"Download Video"** button ready anytime.
- **Knock-to-Join (Waiting Room):**
  - Participants open the WhatsApp link, enter their name, and tap **"Request to Join"**.
  - No password required—Host receives an instant audio chime + floating prompt to **[Admit]** or **[Deny]**.
- **Host Controls:**
  - Start & lead the video session.
  - **Record Session:** Built-in video recording; saves directly to Host's computer upon stopping.
  - **Screen Sharing:** Share full screen, application window, or browser tab.
  - Mute/Unmute microphone, toggle camera on/off, toggle speaker audio.
  - Live **Raised Hands** counter & drawer.
- **Participant Controls:**
  - Mute/Unmute microphone.
  - Camera toggle on/off.
  - Speaker audio toggle.
  - **Raise Hand** button (notifies Host with audio alert & visual indicator).
  - Cannot record, cannot start calls, cannot admit others.
- **Universal Chat:**
  - Unified chat drawer visible to everyone.
  - Real-time messages with distinct badge for the Host.

---

## 🚀 How to Run Locally

### Method 1: Using the 1-Click Launcher (Windows)
Double-click `start.bat`. 
It will start the server and automatically open the Host Dashboard in your default browser.

### Method 2: Using Node.js Command Line
1. Open PowerShell or Command Prompt in this folder:
   ```bash
   node server.js
   ```
2. The terminal will display:
   - **Host Local URL:** `http://localhost:3000`
   - **Mobile / Wi-Fi URL:** `http://<your-local-ip>:3000` (Open this on any phone connected to the same Wi-Fi!)

---

## 📱 How to Share Worldwide via WhatsApp (Any Location & Any Network)

To allow anyone from any location, city, or mobile data network (4G/5G/Wi-Fi) to join via WhatsApp:

### Option 1: 10-Second Free Cloud Hosting (Recommended - Permanent URL)
Since the app runs with PeerJS Cloud and browser WebRTC, you can host it for free on **Netlify** or **Vercel**:
1. Go to **[Netlify Drop](https://app.netlify.com/drop)** (no code or terminal needed).
2. Drag and drop the `live-session-app` folder directly into your browser window.
3. Netlify will instantly give you a free, permanent HTTPS link (e.g., `https://my-live-class.netlify.app`).
4. Open your link, click **Create Session**, and the WhatsApp button will generate global links that work anywhere on Earth!

---

### Option 2: 1-Click Cloud Tunnel from Your PC (`start-cloud.bat`)
If you want to keep running it on your computer:
1. Double-click **`start-cloud.bat`**.
2. It launches the local server and generates a free public HTTPS web link via Localtunnel (e.g., `https://random-name.loca.lt`).
3. Paste that link into the **"Network Web Address"** box on your dashboard, and your WhatsApp share link will be instantly accessible to everyone worldwide!
Run:
```bash
npx localtunnel --port 3000
```
Share the generated `https://...` link with participants on WhatsApp!
