# Lina Pure Nails Backend

Backend server for Lina Pure Nails appointment management system.

## Features

- Appointment management
- User management
- Notification system (WhatsApp API, Venom Bot for WhatsApp, and SMS)

## Setup

### Prerequisites

- Node.js (v16+)
- MongoDB
- Twilio account (for SMS)
- WhatsApp Business API access (for official WhatsApp API)
- A WhatsApp account (for Venom Bot)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables in `.env` file:
   ```
   # MongoDB connection
   MONGODB_URI=mongodb://localhost:27017/lina-nails-local
   
   # Server config
   PORT=4002
   NODE_ENV=development
   
   # WhatsApp API credentials
   VITE_WHATSAPP_ID=your_whatsapp_id
   VITE_WHATSAPP_TOKEN=your_whatsapp_token
   VITE_WHATSAPP_VERSION=v22.0
   
   # Twilio SMS API credentials
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Appointments

- `POST /api/appointments` - Create a new appointment
- `POST /api/appointments/:id/send-whatsapp` - Send WhatsApp notification using official WhatsApp API
- `POST /api/appointments/:id/send-venom-whatsapp` - Send WhatsApp notification using Venom Bot
- `POST /api/appointments/:id/send-sms` - Send SMS notification for an appointment
- `POST /api/appointments/:id/send-notification` - Send notifications using any combination of methods

### Users

- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update an existing user

## Notification System

### SMS Notifications

The system uses Twilio to send SMS notifications to clients. To send an SMS notification:

```javascript
// Send SMS for a specific appointment
fetch('/api/appointments/[appointment-id]/send-sms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lang: 'en' // or 'ar' for Arabic
  })
});
```

### WhatsApp Notifications (Official API)

The system uses WhatsApp Business API to send WhatsApp notifications to clients. To send a WhatsApp notification:

```javascript
// Send WhatsApp message for a specific appointment using official API
fetch('/api/appointments/[appointment-id]/send-whatsapp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lang: 'en' // or 'ar' for Arabic
  })
});
```

### WhatsApp Notifications (Venom Bot)

The system also supports sending WhatsApp messages using Venom Bot, which doesn't require WhatsApp Business API approval:

```javascript
// Send WhatsApp message for a specific appointment using Venom Bot
fetch('/api/appointments/[appointment-id]/send-venom-whatsapp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lang: 'en' // or 'ar' for Arabic
  })
});
```

### Combined Notifications

You can send notifications using multiple methods at once:

```javascript
// Send notifications using multiple methods
fetch('/api/appointments/[appointment-id]/send-notification', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lang: 'en', // or 'ar' for Arabic
    methods: ['sms', 'whatsapp', 'venom'] // specify which methods to use
  })
});
```

The combined notification endpoint allows you to send messages using any combination of the available methods (SMS, WhatsApp API, and Venom Bot).

```javascript
// Send both SMS and WhatsApp notifications
fetch('/api/appointments/[appointment-id]/send-notification', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lang: 'en', // or 'ar' for Arabic
    methods: ['sms', 'whatsapp'] // specify which methods to use
  })
});
```

## Development

- Build for production: `npm run build`
- Start production server: `npm start`

## WhatsApp (UltraMsg) Configuration

Set the following environment variables (no hardcoded defaults are used):

- `ULTRAMSG_INSTANCE_ID` — UltraMsg instance numeric id (e.g. `154818`).
- `ULTRAMSG_TOKEN` — UltraMsg API token for your instance.
- `ULTRAMSG_IMAGE_URL` — Public image URL to send with reminders (e.g. brand logo).
- `DEFAULT_COUNTRY_CODE` — Optional; used for phone normalization (default `970`).

Example `.env`:

```
ULTRAMSG_INSTANCE_ID=154818
ULTRAMSG_TOKEN=xxxxxxxxxxxxxxxx
ULTRAMSG_IMAGE_URL=https://raw.githubusercontent.com/Ghazalsal/image/main/logo-lina.png
DEFAULT_COUNTRY_CODE=970
```

Notes:
- Formatted appointment reminders send only the image with the caption.
- Raw text messages use the two-argument path and send chat text only.