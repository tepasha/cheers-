#!/usr/bin/env node
/**
 * Deletes an account on request (e-mail to support from someone who no longer has the app: Google Play account
 * deletion policy). Runs exactly the same code as the in-app deletion (lib/account.js), as an operator.
 *
 *   npm --prefix functions run build
 *   GOOGLE_APPLICATION_CREDENTIALS=key.json node functions/scripts/delete-account.mjs <project-id> <database-id> <email>
 *
 * Prints what it found and asks nothing: double-check the e-mail first. Find a user by e-mail only after verifying
 * that the request came from that address.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deleteAccount } = require('../lib/account.js');
const { createAccountDeps } = require('../lib/deps.js');

const [projectId, databaseId, email] = process.argv.slice(2);
if (!projectId || !databaseId || !email) {
  console.error('usage: delete-account.mjs <project-id> <database-id> <email>');
  process.exit(2);
}

initializeApp({ projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
console.log(`Deleting ${user.uid} (${user.email}, providers: ${user.providerData.map((p) => p.providerId).join(', ')})`);

// An operator acts on a verified request, so the "recent sign-in" check is satisfied by passing the current time
const now = Date.now();
const result = await deleteAccount(createAccountDeps(getFirestore(databaseId), auth), user.uid, Math.floor(now / 1000), now);
console.log('Done', result);
