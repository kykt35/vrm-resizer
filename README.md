<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase Hosting Deployment

1. Install the Firebase CLI if you haven't already:
   `npm install -g firebase-tools`
2. Authenticate and link this repo to your Firebase project:
   `firebase login && firebase use --add`
   Replace `YOUR_FIREBASE_PROJECT_ID` in `.firebaserc` if you prefer to set it manually.
3. Build the production bundle:
   `npm run build`
4. Deploy just the hosting targets:
   `firebase deploy --only hosting`

The `firebase.json` file publishes the `dist` directory and rewrites all routes to `index.html`, which keeps the client-side router intact.
