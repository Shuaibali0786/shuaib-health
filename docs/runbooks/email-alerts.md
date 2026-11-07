# Clinic email alerts (Feature 012)

Two emails to the clinic's own inbox: **a new booking** (as it happens) and **a morning summary** ("Today 8, tomorrow 5", 08:00 Karachi, from Vercel Cron). Both carry the same masked details as the Command Centre (first name and initial, masked phone, reference) and a button to open it. **Everything is OFF until you turn it on**; nothing is sent while `EMAIL_ALERTS_ENABLED` is false or any of the settings below is missing.

## Recommended free service: Resend

- Free plan: 3,000 emails a month, 100 a day, one verified domain, no card. A small clinic uses a few dozen a day.
- One HTTPS call with an API key, which is all the code needs (`backend/app/notifications/sender.py`). Changing provider later means changing only that one function.
- Alternative if you never get a domain: Brevo (300 a day free), but its sender verification is clumsier and it needs a different `deliver` call.

## What you set up (I will not sign up for anything)

1. Create a free account at resend.com with the email that should receive the alerts.
2. **Without a domain (fine for your own demo):** use the sender `onboarding@resend.dev`. Resend only delivers that sender's mail to the address you signed up with, which is exactly right for alerts to yourself.
3. **For a real clinic:** add the clinic's domain in Resend and add the three DNS records it shows (SPF, DKIM, and a return path). Then use a sender such as `alerts@clinic-domain.com` and any recipients.
4. Create an API key (sending access only). Treat it like a password.
5. On the **API** Vercel project (shuaib-health-api), Production environment, set:

   | Variable | Value |
   |---|---|
   | `EMAIL_API_KEY` | the Resend key |
   | `EMAIL_ALERTS_FROM` | the sender, e.g. `Shuaib Health <onboarding@resend.dev>` |
   | `EMAIL_ALERTS_TO` | recipients, comma-separated |
   | `EMAIL_ALERTS_LINK` | `https://shuaib-health-web.vercel.app/admin` (the button) |
   | `EMAIL_ALERTS_ENABLED` | `true` (set this last) |

6. Redeploy the API project (environment variables apply to new deployments only).

## Check it works

- Book a sample appointment on the site: the "New booking" email arrives within a few seconds.
- The morning summary can be triggered by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://shuaib-health-api.vercel.app/internal/maintenance/daily-summary` (answers `{"status":"sent"}`, or `{"status":"disabled"}` while the flag is off).

## Turn it off

Set `EMAIL_ALERTS_ENABLED=false` and redeploy the API, or use Instant Rollback. A failed send never fails a booking: the alert is best effort and a failure is logged without the key or the address.

## Limits to know

- The new-booking email is sent while the booking request is being answered (a serverless function cannot send later). It adds a second or two to a booking, and at most four seconds if Resend is slow.
- The morning summary runs once a day (Vercel Hobby allows one run per cron entry per day, and two entries per project; this is the second).
