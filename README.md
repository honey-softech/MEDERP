# MedERP

Hospital ERP starter for **web** (Next.js), **mobile** (Flutter), and **PostgreSQL**.

```
mederp/
  apps/web      Next.js 16 + Prisma (staff dashboard + API)
  apps/mobile   Flutter (Android, iOS, web, Windows)
  docker-compose.yml
```

## Prerequisites (installed on this machine)

- Node.js 24 and npm
- Git
- Flutter 3.47 (stable) at `C:\Users\Dhanush\flutter` (added to your user PATH)
- PostgreSQL 16 service `postgresql-x64-16` (user `postgres`, password `mederp_dev`)
- Android Studio (open it once to finish Android SDK setup)

Flutter web works in Chrome today. Android builds need the SDK from Android Studio's first-run wizard. Windows desktop Flutter needs Visual Studio with the C++ workload if you want that later.

Docker Compose is included as an optional database alternative. Docker Desktop on Windows needs WSL, which is not installed.

## 1. Database

Create the `mederp` database (after PostgreSQL is running):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE mederp;"
```

Password: `mederp_dev`

Or with Docker:

```powershell
docker compose up -d
```

Copy env file:

```powershell
copy apps\web\.env.example apps\web\.env
```

Migrate and seed:

```powershell
cd apps\web
npx prisma migrate dev --name init
npx prisma db seed
```

## 2. Web app

```powershell
cd apps\web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 3. Mobile app

```powershell
cd apps\mobile
flutter pub get
flutter run
```

The app calls the Next.js API at `http://localhost:3000`. Android emulators should use `http://10.0.2.2:3000` instead (see `apps/mobile/lib/api/api_client.dart`).

## Modules

| Area | What it covers |
| --- | --- |
| Patients | Registration, MRN, demographics |
| Appointments | Scheduling with doctors and departments |
| Staff | Roles (admin, doctor, nurse, pharmacy, lab, billing) |
| Wards & beds | Inpatient admissions |
| Pharmacy | Medicine stock and prescriptions |
| Laboratory | Test catalog and orders |
| Billing | Invoices and line items |
| Records | Encounter notes |

API starters:

- `GET /api/health`
- `GET /api/patients`

## Local credentials

| Item | Value |
| --- | --- |
| Postgres user | `postgres` |
| Postgres password | `mederp_dev` |
| Database | `mederp` |
| Port | `5432` |
| `DATABASE_URL` | `postgresql://postgres:mederp_dev@localhost:5432/mederp?schema=public` |

Change these before any real hospital data is stored.
