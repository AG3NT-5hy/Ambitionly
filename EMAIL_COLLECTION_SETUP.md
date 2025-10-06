# Email Collection System Setup Guide

This guide explains how to set up and use the secure email collection system that saves user emails server-side and provides access through developer settings.

## Overview

The email collection system:
- ✅ **Collects emails** from user signup and login
- ✅ **Stores server-side only** (not on user devices)
- ✅ **Provides admin access** through developer settings
- ✅ **Supports copy/export** functionality
- ✅ **Tracks source** (signup vs login)
- ✅ **Maintains statistics** and analytics

## How It Works

### 1. Email Collection
- When users sign up or log in, their email is automatically collected
- Emails are stored in a secure server-side JSON file (`data/collected-emails.json`)
- Each email record includes:
  - Email address
  - User ID
  - Timestamp
  - Source (signup/login)

### 2. Storage Security
- Emails are stored **only on the server** in the `data/` directory
- The `data/` directory is excluded from version control (`.gitignore`)
- No email data is stored on user devices
- Access is restricted to developer settings only

### 3. Admin Access
- Access through Developer Settings (requires authentication)
- View all collected emails with statistics
- Copy all emails to clipboard
- Export emails as TXT or CSV
- Clear all collected emails

## Setup Instructions

### 1. Environment Setup
No additional environment variables are required. The system uses the existing server infrastructure.

### 2. Directory Structure
The system creates a `data/` directory for email storage:
```
rork-ambitionly--ai-goal-roadmap-app-main/
├── data/
│   └── collected-emails.json  # Email storage (auto-created)
├── lib/
│   └── email-storage.ts       # Email storage service
├── backend/trpc/routes/admin/
│   └── emails/route.ts        # Admin API routes
└── components/
    └── EmailViewer.tsx        # Email viewer component
```

### 3. Testing the System

#### Test Email Collection
```bash
npm run test:emails
```

This will:
- Add test emails to the system
- Display statistics
- Show export functionality
- Verify the system is working

#### Test in Development
1. Start your development server
2. Navigate to Developer Settings
3. Authenticate with developer credentials
4. Click "View Collected Emails"
5. Test the email viewer functionality

## Usage Guide

### Accessing Collected Emails

1. **Open Developer Settings**
   - Navigate to the app
   - Go to Developer Settings
   - Enter developer credentials

2. **View Emails**
   - Click "View Collected Emails"
   - Browse the email list
   - View statistics and details

3. **Copy All Emails**
   - Click "Copy All" button
   - All emails will be copied to clipboard
   - Paste into your preferred email management tool

4. **Export Emails**
   - Click "Export TXT" for plain text format
   - Click "Export CSV" for spreadsheet format
   - Files will be downloaded/shared

### Email Data Structure

Each email record contains:
```json
{
  "email": "user@example.com",
  "userId": "user-123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "signup"
}
```

### Statistics Available

- **Total**: Total number of email records
- **Unique**: Number of unique email addresses
- **Signups**: Emails from user registrations
- **Logins**: Emails from user logins
- **Last Updated**: Timestamp of most recent email

## Security Features

### 1. Server-Side Only Storage
- Emails are never stored on user devices
- All data remains on your server
- Users cannot access collected emails

### 2. Access Control
- Developer settings require authentication
- Only authorized developers can view emails
- No public access to email data

### 3. Data Protection
- Email data is not committed to version control
- Secure file storage with proper permissions
- No external API calls for email storage

## API Endpoints

The system provides these tRPC endpoints:

### Get Emails
```typescript
trpc.admin.emails.get.useQuery()
// Returns: { emails: EmailRecord[], stats: EmailStats }
```

### Export Emails
```typescript
trpc.admin.emails.export.useMutation({ format: 'text' | 'csv' })
// Returns: { content: string, format: string }
```

### Clear Emails
```typescript
trpc.admin.emails.clear.useMutation()
// Returns: { success: boolean, message: string }
```

### Get Statistics
```typescript
trpc.admin.emails.stats.useQuery()
// Returns: { stats: EmailStats }
```

## File Management

### Email Storage File
- **Location**: `data/collected-emails.json`
- **Format**: JSON array of email records
- **Backup**: Consider regular backups of this file
- **Size**: Grows with user base (typically small)

### Data Directory
- **Location**: `data/`
- **Purpose**: Server-side data storage
- **Git**: Excluded from version control
- **Permissions**: Ensure proper server permissions

## Troubleshooting

### Common Issues

1. **No emails appearing**
   - Check if users are actually signing up/logging in
   - Verify the email storage service is working
   - Check server logs for errors

2. **Permission errors**
   - Ensure the `data/` directory has write permissions
   - Check server file system permissions

3. **Export not working**
   - Verify the email data exists
   - Check browser/device sharing capabilities
   - Ensure proper file permissions

### Debug Steps

1. **Check email storage**
   ```bash
   npm run test:emails
   ```

2. **Verify file creation**
   - Check if `data/collected-emails.json` exists
   - Verify file contents and format

3. **Test API endpoints**
   - Use developer tools to test tRPC calls
   - Check network requests in browser

## Privacy Considerations

### Data Collection
- Emails are collected for legitimate business purposes
- Users are aware of account creation/login
- No additional consent required for basic email collection

### Data Usage
- Emails are used for account management
- Admin access is for legitimate business purposes
- Consider implementing data retention policies

### Compliance
- Ensure compliance with local privacy laws
- Consider implementing user data deletion requests
- Document your data collection practices

## Maintenance

### Regular Tasks
1. **Monitor storage size** - Check `data/collected-emails.json` size
2. **Backup data** - Regular backups of email data
3. **Review access** - Audit who has developer access
4. **Clean old data** - Consider data retention policies

### Scaling Considerations
- For large user bases, consider database storage
- Implement data archiving for old records
- Monitor server storage usage

## Next Steps

1. **Test the system** with `npm run test:emails`
2. **Set up monitoring** for email collection
3. **Implement backups** for email data
4. **Consider analytics** for user growth tracking
5. **Review privacy policies** for compliance

The email collection system is now ready to use! Users' emails will be automatically collected and securely stored server-side, accessible only through your developer settings.
