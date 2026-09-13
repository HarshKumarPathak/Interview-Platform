# Admin analytics

The production admin view is served from the web app at `/admin` and is protected by the `users.role` field.

## Enable an administrator

After applying the database schema/migrations, promote the owner account once:

```sql
update users
set role = 'admin'
where email = 'your-admin-email@example.com';
```

Then sign in with that account and open `/admin`.

## Tracked activity

Successful logins are recorded in `login_events`. The admin view exposes aggregate platform metrics and recent activity without exposing raw IP addresses to the browser UI.

Stored operational metadata:

- user ID
- login timestamp
- IP address (server-side operational metadata)
- user-agent (server-side operational metadata)

The database cascade removes a user's login events when that user is deleted.
