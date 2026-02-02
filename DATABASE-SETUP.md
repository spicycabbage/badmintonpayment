# Badminton Drop-in Payment & Court Assignment App

## Database Setup Instructions

### 1. Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account
3. Click "New Project"
4. Fill in:
   - Project name: `badminton-dropin` (or any name)
   - Database password: (create a strong password)
   - Region: Choose closest to you
5. Wait for project to be created (~2 minutes)

### 2. Get Your API Credentials
1. In your Supabase project dashboard, go to **Settings** (gear icon) → **API**
2. You'll see:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
3. Copy both of these

### 3. Update Your App Configuration
1. Open `supabaseClient.ts`
2. Replace these values:
   ```typescript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Paste your Project URL here
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Paste your anon key here
   ```

### 4. Create the Database Table
1. In Supabase dashboard, go to **SQL Editor** (in left sidebar)
2. Click **New Query**
3. Open the file `supabase-schema.sql` from this project
4. Copy all the SQL code and paste it into the Supabase SQL editor
5. Click **Run** button
6. You should see "Success. No rows returned"

### 5. Test the App
1. Run the app: `npm start`
2. Open in browser
3. Add a participant - it should save to the database
4. Open the app in another browser/device - you should see the same data!

## Features
- **Real-time sync**: Changes appear instantly on all devices
- **Payment tracking**: Cash and E-Transfer with notes
- **Court assignment**: Manage playing games and queue
- **OCR**: Upload screenshots to import participant names
- **Multi-device**: Access from any device with internet

## Security Note
The current setup allows anyone with the URL to read/write data. For production use, you should:
1. Add authentication
2. Restrict database policies to authenticated users only
3. Add user roles if multiple admins need different permissions
