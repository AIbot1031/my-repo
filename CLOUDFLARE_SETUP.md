# Cloudflare deployment and database

The public Worker is `https://drink-recommendation-relgt.rtx941031.workers.dev`. Its Cloudflare D1 database binding is `DB`, backed by `drink-recommendation-db` in APAC.

## Deploy

Install the project dependencies, sign in with Wrangler, and deploy:

```sh
npm install
npx wrangler login
npm run deploy:cloudflare
```

The `deploy:cloudflare` script builds with the Cloudflare account binding and publishes the Worker plus its static assets.

## Set the admin password

The previous host's password secret cannot be recovered. Set a new password from an interactive terminal after deployment:

```sh
npm run admin:password
```

The script hides password input, derives the PBKDF2 verifier locally, then sends only the verifier record to Wrangler as `ADMIN_PASSWORD_RECORD`. It does not save the password or verifier in this repository.

## Inspect and back up D1

```sh
npx wrangler d1 list
npx wrangler d1 execute drink-recommendation-db --remote --command "SELECT COUNT(*) AS favorites FROM favorites;"
npx wrangler d1 export drink-recommendation-db --remote --output ./drink-recommendation-backup.sql
```

An SQL export includes account password verifiers and private favorites. Keep backups private and do not commit them.

## Data migration notes

- The initial migration copied 7 registered accounts, 41 favorites, and 2 import markers from the previous host. Passwords were not copied in plaintext.
- Users must sign in again on the Cloudflare hostname because session cookies do not transfer across hostnames.
- Admin sessions and login rate limits were not transferred.
- The former `sonita.chatgpt.site` Site remains separate and its access is restricted to its owner; its data does not sync with this D1.
- `catalog_drinks` is rebuilt from the source catalog when the catalog is first accessed.
