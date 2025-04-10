# Clash2

A React application for managing and displaying cards with actor information and scores.

## Features

- Card management with animations
- Actor name and score tracking
- Video background support
- Real-time state management
- Responsive design

## Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd Clash2
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Project Structure

- `src/pages/`: Main application pages
  - `Regie.js`: Control panel for managing actors and categories
  - `Show.js`: Display page for cards and videos
- `src/store/`: State management
  - `useCardStore.js`: Zustand store for card and actor data
- `src/styles/`: CSS styles and animations
  - `animations.css`: Card animation styles
- `public/assets/`: Static assets
  - `movies/`: Video files
  - `categories.js`: Category definitions

## Technologies Used

- React
- Zustand (State Management)
- CSS Animations
- WebRTC (Webcam Support)

## License

MIT 