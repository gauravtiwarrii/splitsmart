# SplitSmart — Production Deployment Guide

We have successfully initialized Git and pushed the complete codebase to your GitHub repository:
👉 **[github.com/gauravtiwarrii/splitsmart](https://github.com/gauravtiwarrii/splitsmart)**

To host the application live on **Vercel** with a production database, follow these three simple steps:

---

## Step 1: Set Up a Hosted PostgreSQL Database

Since this is a Next.js App Router app using Prisma ORM, it needs a live PostgreSQL instance. You can set one up for free using **Neon** or **Supabase**:

### Option A: Neon (Recommended for serverless)
1. Go to [Neon.tech](https://neon.tech/) and sign up.
2. Create a new project named `splitsmart`.
3. In the Neon dashboard, copy the **Connection String** (choose the `Prisma` tab if available, which uses the transaction pooler pooling mode on port `5432` or `6543`, usually formatted as `postgresql://...`).

### Option B: Supabase
1. Go to [Supabase.com](https://supabase.com/) and sign up.
2. Create a new project named `splitsmart` and set a secure database password.
3. Once the database is ready, go to **Project Settings > Database** and copy the **Connection string** (URI format, Pooler mode).

---

## Step 2: Initialize the Production Database Schema

Before deploying to Vercel, push the Prisma schema to your new live database to create the tables:

1. Open your local `.env` file and temporarily swap the local `DATABASE_URL` with your new live connection string:
   ```env
   DATABASE_URL="postgresql://<username>:<password>@<host>/splitsmart?sslmode=require"
   ```
2. In your terminal, run the Prisma schema push command to sync the tables:
   ```bash
   npx prisma db push
   ```
3. (Optional) Seed the database with the roommates timeline and sample expenses:
   ```bash
   npx prisma db seed
   ```
4. Revert the local `.env` file back to your local database URL (`postgresql://postgres:root@localhost:5432/...`) so your local development environment continues to work offline.

---

## Step 3: Deploy to Vercel

1. Go to [Vercel.com](https://vercel.com/) and sign in with your GitHub account.
2. Click **Add New > Project**.
3. Import the `splitsmart` repository from the list.
4. Under **Environment Variables**, add the following keys:
   * **`DATABASE_URL`**: Paste your live Neon or Supabase connection string.
   * **`AUTH_SECRET`**: Generate a secure random string (you can run `openssl rand -base64 33` in your terminal, or just paste a secure alphanumeric password).
   * **`NEXTAUTH_URL`**: Leave this blank or set it to your assigned Vercel URL once generated (Vercel automatically configures the URL in most cases for NextAuth v5).
5. Click **Deploy**.

Vercel will build the application, set up the Edge middleware functions, and serve your SplitSmart shared expenses dashboard live! Every time you commit and push to your GitHub repository (`git push`), Vercel will automatically deploy the changes.
