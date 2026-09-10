# TaskFlow Pro — Executive Task Management & Google Calendar Integration

TaskFlow Pro is a high-performance executive task manager with audio chime notifications, automated email dispatches via Resend/SMTP, and secure **Google Calendar OAuth 2.0 integration**.

---

## Google Cloud Setup Guide (Manual Configuration)

Follow these instructions step-by-step in the [Google Cloud Console](https://console.cloud.google.com/) to obtain your OAuth credentials and connect Google Calendar to TaskFlow Pro.

### 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top navigation bar and select **New Project**.
3. Enter a **Project Name** (e.g., `TaskFlow-Pro-Calendar`).
4. Click **Create** and ensure your newly created project is selected.

---

### 2. Enable Google Calendar API
1. Open the navigation menu (☰) and navigate to **APIs & Services** > **Library**.
2. In the search box, type **Google Calendar API**.
3. Select **Google Calendar API** from the results and click **Enable**.

---

### 3. Enable Google Sheets API (Optional: If using Sheets for User Storage)
1. In **APIs & Services** > **Library**, search for **Google Sheets API**.
2. Click **Enable**.
3. If using Google Sheets for your user database, also create a Service Account under **APIs & Services** > **Credentials** > **Create Credentials** > **Service Account**, generate a JSON key, and invite the service account email as **Editor** to your Google Sheet.

---

### 4. Configure OAuth Consent Screen
1. In the navigation menu, go to **APIs & Services** > **OAuth consent screen**.
2. Under **User Type**, select **External** and click **Create**.
3. Fill in the required **App information**:
   - **App name**: `TaskFlow Pro`
   - **User support email**: Select your Google account email.
   - **Developer contact information**: Enter your email address.
4. Click **Save and Continue**.

---

### 5. Configure Calendar Scopes
1. On the **Scopes** page, click **Add or Remove Scopes**.
2. In the filter box, search for `calendar.events`.
3. Check the box for:
   - `.../auth/calendar.events` — *See, edit, share, and permanently delete all the events you can access using Google Calendar*
4. Also check:
   - `.../auth/userinfo.email` — *See your primary Google Account email address*
   - `openid` — *Associate you with your personal info on Google*
5. Click **Update** at the bottom, then click **Save and Continue**.

> [!TIP]
> **Test Users**: While the app is in "Testing" publishing status, navigate to **Test users** on the consent screen and click **Add Users** to add your personal Gmail address so Google allows you to log in during development.

---

### 6. Create OAuth 2.0 Client ID
1. In the navigation menu, navigate to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. In the **Application type** dropdown, select **Web application**.
4. Set the **Name** (e.g., `TaskFlow Pro Web Client`).

---

### 7. Add Authorized Redirect URIs
In the **Authorized redirect URIs** section of the OAuth Client configuration, click **+ Add URI** and add:

- **Local Development**:
  ```text
  http://localhost:8080/auth/google/callback
  ```

- **Production (Vercel)**:
  ```text
  https://task-manager-website-psi.vercel.app/auth/google/callback
  ```
  *(Replace with your custom domain if applicable)*

In the **Authorized JavaScript origins** section, add:
- `http://localhost:8080`
- `https://task-manager-website-psi.vercel.app`

Click **Create**. A dialog will display your **Client ID** and **Client Secret**.

---

### 8. Add Credentials to `.env`
Create or update your `.env` file in the root directory:

```env
# Google Calendar OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback

# Application URL (used for OAuth callbacks and reset links)
APP_URL=http://localhost:8080

# JWT Session Security
JWT_SECRET=your_jwt_secret_key_here

# Email Service (Resend or SMTP)
RESEND_API_KEY=re_your_api_key
FROM_EMAIL=TaskFlow Pro <onboarding@resend.dev>
```

For production deployment on Vercel:
1. Go to your **Vercel Project Dashboard** > **Settings** > **Environment Variables**.
2. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and set `GOOGLE_REDIRECT_URI=https://your-app.vercel.app/auth/google/callback`.

---

## Architecture & Authentication Separation

- **Application Authentication**: Managed separately via email/password, bcrypt hashing (12 rounds), and secure HTTP-only cookies.
- **Google Calendar Authorization**: An optional integration authorized via standard Google OAuth 2.0 (`/auth/google` -> `/auth/google/callback`).
- **Token Security**: Stored refresh tokens are held exclusively in backend storage and are **never exposed** to the frontend client.
- **Revocation / Disconnect**: Users can disconnect Google Calendar at any time via `POST /api/calendar/disconnect`, which revokes the Google token and clears storage without affecting their application login or tasks.

---

## Google Calendar Reminders (Zero Application Storage)

Google Calendar is the **sole source of truth** for all reminders and calendar events:
- **No Database / Sheet for Reminders**: Reminders are never saved in the application database or Google Sheets.
- **No Schedulers or Cron Jobs**: Events and reminder overrides are created immediately in the user's primary Google Calendar via `calendar.events.insert()`. Google's native infrastructure handles dispatching the notifications.
- **Endpoint**: `POST /api/calendar/reminders`
  ```json
  {
    "title": "Team Meeting",
    "description": "Weekly team meeting",
    "startTime": "2026-09-10T20:00:00+05:30",
    "endTime": "2026-09-10T21:00:00+05:30",
    "reminderMinutes": 10,
    "timeZone": "Asia/Kolkata"
  }
  ```
  Returns:
  ```json
  {
    "success": true,
    "message": "Reminder added to Google Calendar.",
    "event": {
      "id": "...",
      "htmlLink": "..."
    }
  }
  ```
