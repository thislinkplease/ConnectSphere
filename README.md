# Connect Sphere — Frontend (Client)

Connect Sphere is a social networking application that enables users to connect, join communities, share posts, participate in events, hang out with others and chat through a clean and modern mobile experience.

The frontend is built using React Native (Expo) and communicates with a Node.js + Supabase backend to support media uploads, community interactions, user accounts and real-time-like features.

---

## 1. Tech Stack

- React Native (Expo)

- TypeScript

- expo-router

- Axios (ApiService)

- Supabase Client

- React Context (Auth, Theme)

- React Native Paper UI

- File uploads via backend APIs

---

## 2. Setup & Installation
Requirements

- Node.js 18+

- npm or yarn

- Expo CLI

Install Expo CLI:

`npm install -g expo-cli`

---

## 3. Clone the Project
```bash
git clone https://github.com/thislinkplease/ConnectSphere.git
cd .\ConnectSphere\
```

---

## 4. Install Dependencies
`npm install`

---

## 5. Environment Variables

Inside the frontend/ directory, create a .env file:
```bash
EXPO_PUBLIC_API_URL=https://your-backend-url.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=yourkey
```


The app will not run without valid API URLs and Supabase keys.

---

## 6. Run the App

Start the Expo:

`npx expo start`

Then choose one of the following:

- Press i to launch the iOS simulator

- Press a to launch Android

Or open the QR code using the Expo Go app on your phone

---

## 7. Key Features

- User authentication (login, register, token-based sessions)

- User profiles with avatars and cover images

- Post creation with text and images

- Likes, comments, and media viewer

- Communities: join, leave, admin/moderator tools

- Events: create, join, interested

- Hangout: user suggestions and location features

- Community chat and private messaging

- Pro membership support

---

## 8. Authors 

- Developed by **Arcane Team**