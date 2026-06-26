# Gudang Puspa Coffee

PWA sederhana untuk mencatat nama stock, jenis stock, barang masuk, barang keluar, dan sisa stock Gudang Puspa Coffee.

## Fitur

- Overview stock keseluruhan
- Input dan hapus nama stock
- Jenis per stock, seperti Green Bean, Gabah, atau Cherry
- Tab info: Masuk Barang, Stock Gudang, Keluar Gudang, Sisa Stock
- Export transaksi ke CSV dengan kolom Qty Masuk dan Qty Keluar terpisah
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
4. Duplikasi `config.example.js` menjadi `config.js`.
5. Isi `supabaseUrl` dan `supabaseAnonKey` dari dashboard Supabase.

File `config.js` sengaja masuk `.gitignore` supaya key project tidak ikut commit.

Catatan: policy di `supabase/schema.sql` masih dibuat permisif untuk tahap awal. Untuk production, sebaiknya tambahkan login dan batasi akses per user atau per role.

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
