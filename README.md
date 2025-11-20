# WEB-VRM-KIT

A lightweight browser-based tool for editing VRM files. Easily parse VRM files and perform texture replacement, resizing, and metadata editing.

🌐 **Live Site**: [https://vrm-kit.web.app/](https://vrm-kit.web.app/)

## Features

- **VRM File Upload and Parsing**: Load GLB-format VRM files and decompose them into JSON and BIN chunks
- **Texture Replacement**: Replace existing textures with new images
- **Texture Resizing**: Change texture sizes individually or in bulk
- **Metadata Editing**: View and edit VRM file metadata
- **Thumbnail Replacement**: Change the VRM file's thumbnail image
- **Real-time Preview**: Preview changes in a 3D viewer before applying them
- **Processed File Download**: Download the edited VRM file

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Three.js** - 3D rendering
- **@pixiv/three-vrm** - VRM model loading and display
- **Firebase Hosting** - Deployment

## Setup

### Prerequisites

- Node.js (Recommended: v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd vrm-kit
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (if using Firebase):

Create a `.env.local` file and set the following environment variables:

```env
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Development

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Build

Create a production build:

```bash
npm run build
```

The build output will be in the `dist` directory.

## Deployment

### Firebase Hosting

1. Install Firebase CLI (if not already installed):

```bash
npm install -g firebase-tools
```

2. Log in to Firebase and link your project:

```bash
firebase login
firebase use --add
```

3. Build and deploy:

```bash
npm run build
firebase deploy --only hosting
```

The `firebase.json` file publishes the `dist` directory and rewrites all routes to `index.html` to maintain the client-side router.

## Usage

1. **Upload VRM File**: Select a `.vrm` file on the home screen
2. **View Metadata**: Check VRM file information in the "Metadata" tab on the right panel
3. **Change Thumbnail**: Replace the thumbnail image in the "Thumbnail" tab
4. **Edit Textures**: Replace or resize textures in the "Textures" tab
5. **Preview**: Apply changes and preview in the 3D viewer
6. **Download**: Download the processed VRM file

## Project Structure

```text
vrm-kit/
├── components/          # React components
│   ├── AppHeader.tsx
│   ├── ModelPreview.tsx
│   ├── RightPanel.tsx
│   ├── VrmViewer.tsx
│   └── ...
├── services/            # Business logic
│   └── vrmService.ts    # VRM file parsing and processing
├── hooks/               # Custom hooks
├── constants/           # Constants
├── libs/                # Library configuration
└── types.ts             # TypeScript type definitions
```

## License

Please refer to the LICENSE file in the repository for license information.
