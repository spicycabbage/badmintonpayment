# Badminton Drop-in Payment Tracker

A mobile app to track Cash and E-Transfer payments for your badminton drop-in sessions.

## Features

- 📸 **Upload screenshot to auto-parse participant names (OCR)**
- ✅ Add participants manually
- 💵 Track Cash payments
- 💳 Track E-Transfer payments
- 📝 Add notes for E-Transfer names that don't match registration
- 💾 Persistent storage - data saved between sessions
- 📊 Payment progress counter
- 🔄 Toggle payment status by tapping buttons again

## How to Use

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the web app:**
   ```bash
   npm run web
   ```

3. **Access on your phone:**
   - Open the URL shown in the terminal (e.g., `http://192.168.x.x:8081`)
   - On your phone's browser, navigate to that URL
   - Add to home screen for app-like experience:
     - **iPhone/Safari**: Tap Share → Add to Home Screen
     - **Android/Chrome**: Tap menu (⋮) → Add to Home Screen

### Using the App

1. **Add Participants (Quick Method - Upload Screenshot):**
   - Take or have a screenshot of your participant list ready
   - Tap "📸 Upload Screenshot"
   - Select the image from your gallery
   - Wait for OCR processing (a few seconds)
   - Review the parsed names
   - Remove any incorrect entries by tapping them
   - Tap "Add X Participants" to import them all at once

2. **Add Participants (Manual Entry):**
   - Tap "+ Add Manual"
   - Enter the participant's name
   - Tap "Add"

3. **Record Payments:**
   - **For Cash:** Tap the "Cash" button next to the participant's name
   - **For E-Transfer:** Tap the "E-Transfer" button
     - You'll be prompted to add a note (optional)
     - Use this to record the actual E-Transfer sender name if different

4. **View Payment Status:**
   - Paid participants show a checkmark (✓) and colored background
   - Green = Cash
   - Blue = E-Transfer
   - Notes appear below the name if added

5. **Clear Payment:**
   - Tap a selected payment button again to clear it

6. **Clear All:**
   - Use the "Clear All" button to remove all participants and start fresh

## Mobile Web Tips

- **Add to Home Screen** for quick access and app-like experience
- **Works offline** after first load (data saved locally)
- **No app store required** - just visit the URL on your phone
- **Screenshot upload** works directly from your phone's camera roll

## Payment Tracking Tips

- **Best OCR Results:** Use clear screenshots with good contrast and readable text
- The OCR works best with simple lists of names (one per line)
- Review parsed names before adding - you can tap any incorrect entries to remove them
- The app saves data automatically - close and reopen anytime
- Use the note field for E-Transfers to track sender names like "John Smith sent from Jane Smith's account"
- The progress counter at the top shows how many have paid
- OCR uses a free public API - works without any setup or API keys

## Deployment

To host this permanently:
- Deploy to Vercel, Netlify, or GitHub Pages
- Run `npx expo export:web` to build static files
- Upload the `web-build` folder to your hosting service
