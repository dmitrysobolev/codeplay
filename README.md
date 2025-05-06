# GitHub File Browser & Code Viewer

A modern, accessible, and beautiful file/code browser for GitHub repositories, built with [Next.js](https://nextjs.org) and React.

## What is this?

This project lets you explore and read the code of any public or private GitHub repository in a fast, user-friendly interface. It features:

- **Hierarchical file tree**: Browse folders and files just like on GitHub, with folders-first sorting and expand/collapse.
- **Code viewer**: View code with syntax highlighting (powered by Prism), line numbers, and a responsive layout.
- **Theme selection**: Choose from a curated set of dark Prism themes for your code view.
- **Keyboard accessibility**: Navigate the file tree and control playback with your keyboard.
- **Auto-scroll & playback**: Auto-scrolls through code files, with Play/Pause and auto-advance to the next file. Short files are shown for 1 second before advancing.
- **GitHub token support**: Add your personal GitHub token in Settings (⚙️) for private repos or higher rate limits. Token is stored only in your browser.
- **Resizable panes & fullscreen**: Adjust the file tree width and view code in fullscreen mode.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```
2. **Run the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```
3. **Open your browser:**
   Go to [http://localhost:3000](http://localhost:3000)

## Usage

- Enter a GitHub repo URL (e.g. `https://github.com/owner/repo` or `owner/repo`) and click **Go!**
- Browse the file tree and click files to view their code.
- Use the bottom panel to Play/Pause auto-scroll, change theme, go fullscreen, or open Settings (⚙️) to set your GitHub personal token.

---

Enjoy exploring code with a modern, accessible UI!

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
