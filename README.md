# Gudang Puspa Coffee

PWA sederhana untuk mencatat nama stock, jenis stock, barang masuk, barang keluar, dan sisa stock Gudang Puspa Coffee.

## Fitur

- Overview stock keseluruhan
- Input dan hapus nama stock
- Jenis per stock, seperti Green Bean, Gabah, atau Cherry
- Tab info: Masuk Barang, Stock Gudang, Keluar Gudang, Sisa Stock
- Export transaksi ke CSV dengan kolom Qty Masuk dan Qty Keluar terpisah
- Login Supabase Auth dengan role `admin` dan `staff`
- Login lokal sementara saat Supabase belum aktif
- Backup dan import database lokal dengan file JSON
- PWA dengan manifest, icon, dan service worker
- Siap disambungkan ke Supabase

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

## Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `supabase/schema.sql`.
4. Untuk lokal, duplikasi `config.example.js` menjadi `config.js`.
5. Isi `supabaseUrl` dan `supabaseAnonKey` dari dashboard Supabase.
6. Untuk Vercel, isi Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

File `config.js` sengaja masuk `.gitignore` supaya key project tidak ikut commit.

### Role Login

- `admin`: bisa input nama stock, hapus nama stock, hapus transaksi, dan export CSV.
- `staff`: bisa login, input transaksi, melihat stock, dan melihat riwayat.

Kalau Supabase belum dikonfigurasi, aplikasi memakai login lokal sementara:

- Admin: `admin@puspa.local` / `admin123`
- Staff: `staff@puspa.local` / `staff123`

Mode lokal hanya untuk sementara karena datanya tersimpan di browser perangkat. Gunakan tombol `Backup Data` dan `Import Data` di `Pengaturan Stock` untuk menyimpan salinan database lokal.

Setelah menjalankan schema, buat user dari Supabase Dashboard > Authentication > Users. User baru otomatis menjadi `staff`. Untuk membuat admin pertama, jalankan SQL ini di Supabase SQL Editor:

```sql
update public.user_profiles
set role = 'admin'
where id = 'USER_ID_DARI_AUTH_USERS';
```

Ganti `USER_ID_DARI_AUTH_USERS` dengan ID user yang ada di halaman Authentication.

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
