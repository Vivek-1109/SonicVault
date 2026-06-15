# SonicVault 🎧

SonicVault is a private, ad-free, personal music streaming application. It provides a Spotify-like experience allowing you to upload, organize, stream, and download your own music collection.

## Features
- **Stream Anywhere**: High quality audio streaming via Cloudflare R2
- **Offline First**: Download songs to your device for offline playback
- **Admin Dashboard**: Easy drag-and-drop web dashboard for uploading and managing your library
- **Premium Mobile UI**: Beautiful, dynamic interface built with Expo and React Native
- **Automatic ID3 Tagging**: Automatically extracts title, artist, album, and artwork on upload
- **Low Cost**: Designed to run practically for free using Cloudflare R2's generous free tier and a cheap VPS

## Architecture
1. **Backend**: Express.js + SQLite (WAL mode)
2. **Admin Dashboard**: Vanilla JS SPA served by the backend
3. **Mobile App**: React Native (Expo SDK 56)

## Deployment (Docker)

The easiest way to deploy the backend and admin dashboard is using Docker Compose.

1. Clone the repository to your server.
2. Copy `.env.example` to `.env` in the `backend` directory and fill in your Cloudflare R2 credentials.
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env
   ```
3. From the project root, run:
   ```bash
   docker-compose up -d
   ```
4. Access the admin dashboard at `http://<your-server-ip>:3000`

## Mobile App Development

To run the mobile app locally:

1. Update the `API_BASE_URL` in `mobile/constants/config.ts` to point to your deployed backend (or local IP for testing).
2. Install dependencies:
   ```bash
   cd mobile
   npm install --legacy-peer-deps
   ```
3. Start the Expo server:
   ```bash
   npx expo start
   ```

*Note: For full background audio and biometrics support, you must build the app using EAS Build (`eas build`), as Expo Go does not support all required native capabilities.*
