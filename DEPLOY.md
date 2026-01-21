# Deployment Guide

Deploy your Eagle Payment app to make it accessible from anywhere.

## Build for Production

First, build the web version:

```bash
npx expo export:web
```

This creates a `web-build` folder with all static files.

## Option 1: Vercel (Easiest)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd web-build
   vercel
   ```

3. Follow prompts, get your live URL

## Option 2: Netlify

1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `web-build` folder
3. Get your live URL instantly

## Option 3: GitHub Pages

1. Build the app:
   ```bash
   npx expo export:web
   ```

2. Push `web-build` folder to your repo's `gh-pages` branch

3. Enable GitHub Pages in repo settings

## Option 4: Your Own Server

Upload the `web-build` folder contents to any web server:
- Apache
- Nginx  
- Any static hosting

Just point the server to serve the files and you're done.

## Custom Domain

All platforms above support custom domains:
- Buy domain from any registrar
- Point DNS to your hosting provider
- Follow their docs to connect it

## Important Notes

- OCR requires internet connection (uses external API)
- Data is stored in browser's localStorage
- Works on any modern mobile browser
- No server or database needed
- Completely free to host on Vercel/Netlify free tiers

## Sharing with Users

Once deployed, just share the URL:
- Text it to participants
- Post in group chat
- Email the link
- Users can add to home screen for easy access
