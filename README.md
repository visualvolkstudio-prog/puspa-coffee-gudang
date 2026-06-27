# Gudang Puspa Coffee

PWA sederhana untuk mencatat nama stock, jenis stock, barang masuk, barang keluar, dan sisa stock Gudang Puspa Coffee.

## Fitur

- Overview stock keseluruhan
- Input dan hapus nama stock
- Jenis per stock, seperti Green Bean, Gabah, atau Cherry
- Tab info: Masuk Barang, Stock Gudang, Keluar Gudang, Sisa Stock
- Export transaksi ke CSV dengan kolom Qty Masuk dan Qty Keluar terpisah
- Login Firebase Auth dengan role `admin` dan `staff`
- Login lokal sementara saat Firebase belum aktif
- Backup dan import database lokal dengan file JSON
- PWA dengan manifest, icon, dan service worker
- Tersambung ke Firebase Firestore

## Jalankan Lokal

```bash
python3 -m http.server 4173
```

Buka:

```text
http://localhost:4173
```

PWA/service worker hanya aktif di `localhost` atau HTTPS. Kalau dibuka langsung dari `file://`, aplikasi tetap jalan tetapi mode PWA tidak aktif.

## GitHub Pages

1. Push folder ini ke repository GitHub.
2. Buka repository Settings.
3. Masuk ke Pages.
4. Pilih branch utama dan root folder.
5. Simpan, lalu buka URL GitHub Pages yang diberikan.

## Firebase

Firebase dipakai sebagai backend utama:

- Authentication: login email/password
- Firestore: database stock dan transaksi
- `user_profiles`: role user

Collection yang dipakai:

```text
user_profiles
stock_items
stock_transactions
```

Rules Firestore:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn()
        && exists(/databases/$(database)/documents/user_profiles/$(request.auth.uid))
        && get(/databases/$(database)/documents/user_profiles/$(request.auth.uid)).data.role == "admin";
    }

    function isStaff() {
      return signedIn()
        && exists(/databases/$(database)/documents/user_profiles/$(request.auth.uid))
        && get(/databases/$(database)/documents/user_profiles/$(request.auth.uid)).data.role in ["admin", "staff"];
    }

    match /user_profiles/{userId} {
      allow read: if signedIn() && request.auth.uid == userId;
      allow write: if isAdmin();
    }

    match /stock_items/{itemId} {
      allow read: if isStaff();
      allow create, update, delete: if isAdmin();
    }

    match /stock_transactions/{transactionId} {
      allow read: if isStaff();
      allow create: if isStaff();
      allow update, delete: if isAdmin();
    }
  }
}
```

Untuk admin pertama, buat user di Firebase Authentication, lalu buat document:

```text
Collection: user_profiles
Document ID: UID user admin
role: admin
email: email admin
```

Pastikan domain Vercel masuk di Firebase Authentication > Settings > Authorized domains:

```text
puspa-coffee-gudang.vercel.app
```

### Role Login

- `admin`: bisa input nama stock, hapus nama stock, hapus transaksi, backup/import, dan export CSV.
- `staff`: bisa login, input transaksi, melihat stock, dan melihat riwayat.

Kalau Firebase belum aktif, aplikasi memakai login lokal sementara:

- Admin: `admin@puspa.local` / `admin123`
- Staff: `staff@puspa.local` / `staff123`

Mode lokal hanya untuk sementara karena datanya tersimpan di browser perangkat. Gunakan tombol `Backup Data` dan `Import Data` di `Pengaturan Stock` untuk menyimpan salinan database lokal.

## Supabase Lama

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `supabase/schema.sql`.
4. Untuk lokal, duplikasi `config.example.js` menjadi `config.js`.
5. Isi `supabaseUrl` dan `supabaseAnonKey` dari dashboard Supabase.
6. Untuk Vercel, isi Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

File `config.js` sengaja masuk `.gitignore` supaya konfigurasi lokal tidak ikut commit.

## Struktur

```text
.
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── config.example.js
├── assets/
└── supabase/
```
