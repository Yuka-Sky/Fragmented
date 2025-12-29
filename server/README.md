# Fragmented Narratives - Backend Setup

## Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Environment Variables

Create a `.env` file in the server directory:

```
PORT=3000
JWT_SECRET=your-secure-secret-key-here
```

## Database

The application uses SQLite with better-sqlite3. The database file `fragmented_narratives.db` will be created automatically on first run.

### Tables:
- **users**: User accounts
- **stories**: Story metadata
- **contributions**: Individual sentence contributions
- **pictures**: Uploaded images
- **story_participants**: Tracks who's participating in each story

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Stories
- `POST /api/stories` - Create new story
- `GET /api/stories/available` - Get available stories for user
- `GET /api/stories/:id` - Get specific story with contributions

### User
- `GET /api/users/history` - Get user's completed stories

## Frontend Integration

The frontend pages already include the necessary fetch calls to these endpoints. Make sure the server is running before using the application.
