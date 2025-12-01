Connect Sphere — Frontend (Client)

Connect Sphere is a social networking application that helps people connect, join communities, share posts, create events, hangout, and chat in a modern and intuitive experience.
The frontend is built with React Native (Expo) and communicates with a Node.js + Supabase backend to support real-time data, media uploads, community interactions and user management.

1. Tech Stack

React Native (Expo)

TypeScript

expo-router

Axios (ApiService)

Supabase Client

React Context (Auth, Theme)

React Native Paper UI

File Uploads via Backend APIs

2. Setup & Installation
Requirements

Node.js 18+

npm or yarn

Expo CLI

npm install -g expo-cli

3. Clone the Project
git clone https://github.com/your-repo/connect-sphere.git
cd connect-sphere/frontend

4. Install Dependencies
npm install

5. Environment Variables

Inside the frontend/ directory, create a .env file:

# Example
EXPO_PUBLIC_API_URL=https://your-backend-url.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=yourkey


The app will not run without correct API URLs and Supabase keys.

6. Run the App

Start the Expo development server:

npm start


Then:

Press “i” to launch iOS Simulator

Press “a” to launch Android

Or scan the QR code using Expo Go on your phone

7. Key Features

User authentication (login, register, token-based sessions)

User profiles, avatars, cover images

Post creation with text and images

Likes, comments, and media viewer

Communities: join, leave, admin/moderator tools

Events: create, join, interested

Hangout: swipe suggested users, location-based features

Community chat and direct user messaging

Pro membership support