# Guest Invoice (Misafir Faturası) — Detaylı Süreç Kılavuzu

Bu belge, sistemdeki **Guest Invoice** (misafir faturası) bölümünün tüm süreçlerini Türkçe olarak açıklar: neler yapılır, nasıl yapılır, kimler yapar.

---

## 1. Genel Bakış

**Guest Invoice**, yayına katılan misafirlere ödenecek ücretler için kullanılan fatura sürecidir. Başlıca aktörler:

- **Producer (Yapımcı)**: Misafiri davet eder, kayıt sonrası kabul işaretler, fatura linki gönderebilir
- **Guest (Misafir)**: Faturayı kendisi yükler veya sistemde oluşturur
- **Manager (Yönetici)**: Faturayı onaylar/reddeder
- **Finance**: Ödeme aşamasını yönetir

**Temel akış:**

1. Producer misafiri davet eder (e-posta ile)
2. Kayıt tamamlanınca Producer "Mark accepted" ile kabul eder
3. Misafir fatura linki alır: ya yükler (PDF) ya da sistemde oluşturur
4. Manager faturayı onaylar
5. Finance ödemeyi yapar

---

## 2. Davetli Misafirlar Sayfası (Invited Guests)

**Yol:** `/invoices/invited-guests`

### 2.1. Ne Yapılır?

- Producer’ın davet ettiği tüm misafirler listelenir
- Misafir ekleme, davet gönderme, toplu işlemler
- Kayıt sonrası "Mark accepted" ile kabul işareti
- Fatura linki gönderme (Send invoice submit link)

### 2.2. Nasıl Yapılır?

#### Yeni Misafir Davet Etme

1. **"Invite Guest"** veya **"+ New"** ile modal açılır
2. Doldurulur:
   - **Guest name** (Misafir adı) — zorunlu
   - **Email** — zorunlu
   - **Title** (Ünvan: Prof, Dr, Mr, Ms vb.)
   - **Program name** (Program adı)
   - **Program-specific topic** (Program konusu)
   - **Record date** ve **Record time** (Kayıt tarihi ve saati)
   - **Format**: Remote / Studio
   - **Studio address** (Stüdyo ise adres)
3. İsteğe bağlı:
   - Program açıklaması ekleme
   - Takvim eki (ICS) ekleme
   - Producer’a BCC
4. **Send Invite** ile davet gönderilir

Davet e-postası misafire gider. Misafir henüz fatura ile ilgilenmez; önce kayda katılır.

#### Toplu Davet

1. Listeden birden fazla misafir seçilir (checkbox)
2. **"Bulk invite"** tıklanır
3. Ortak alanlar doldurulur (program, topic, date, time)
4. **Send** ile toplu davet gönderilir

#### Mark Accepted (Kabul İşareti)

Kayıt tamamlandıktan sonra producer, misafiri "accepted" olarak işaretler:

1. Misafir satırında **"Mark accepted"** tıklanır
2. Modal açılır:
   - **Payment received**: Evet/Hayır (ödeme alacak mı?)
   - **Payment amount** ve **Currency** (ödeme alacaksa)
   - **Recording date**, **Recording topic**, **Program name**
   - **Generate invoice on behalf of guest**:
     - Evet: Banka bilgileri ve fatura no girilir, fatura otomatik oluşturulur ve misafire e-postayla gönderilir
     - Hayır: Misafire fatura yükleme/oluşturma linki gönderilir
3. **Mark accepted** ile kaydedilir

**Önemli:** E-postada fatura linki olması için misafir e-postası zorunludur.

#### Send Invoice Link (Fatura Linki Gönderme)

"Mark accepted" dışında, doğrudan fatura linki de gönderilebilir:

1. **"Send link"** butonu veya **Columns** menüsünden **Send invoice submit link** tıklanır
2. Modal açılır:
   - Guest name, Email, Title, Phone
   - Program name, Recording date, Recording topic
   - Payment amount, Currency
   - **Generate invoice on behalf of guest**: Evet/Hayır
3. **Send link** ile 7 gün geçerli link misafire e-postayla gider

**Limit:** Admin dışında kullanıcı başına günde 5 link sınırı vardır.

---

## 3. Misafir Fatura Gönderme (Guest Submit)

**Yol:** `/submit/guest/[token]`

Misafir, e-postadaki linke tıklayınca bu sayfaya gelir. Link 7 gün geçerlidir ve bir kez kullanılabilir.

### 3.1. İki Seçenek

#### Seçenek A: Upload (Yükleme)

Misafir kendi faturasını (PDF, DOCX, XLSX, JPEG) yükler:

1. **"Upload invoice"** seçilir
2. Para birimi seçilir (GBP, EUR, USD)
3. Dosya seçilip yüklenir
4. **Submit** ile gönderilir

Sistem dosyadan fatura numarasını çıkarmaya çalışır; yoksa dosya adını kullanır.

#### Seçenek B: Generate (Oluşturma)

Misafir sistemde fatura oluşturur:

1. **"Generate invoice"** seçilir
2. Banka bilgileri girilir:
   - **UK**: Account name, Account number, Sort code
   - **International**: Account name, IBAN, SWIFT/BIC, Bank name, Bank address
   - **PayPal** (isteğe bağlı)
3. **Add expense** ile masraflar eklenebilir
4. **Add receipt** ile makbuz eklenebilir
5. Önizleme sonrası **Submit** ile oluşturulur

Banka bilgileri `localStorage`’da saklanır; aynı cihazda tekrar kullanılır.

### 3.2. Gönderim Sonrası

- Token `used_at` ile işaretlenir (bir daha kullanılamaz)
- `producer_guests` tablosunda `matched_invoice_id` ve `matched_at` güncellenir
- Fatura `invoices` tablosuna eklenir, `invoice_type: "guest"`
- Workflow `pending_manager` ile başlar
- Misafire ve producer’a onay e-postası gider

---

## 4. Fatura Durum Takibi (Status)

**Yol:** `/submit/status/[token]`

Misafir faturayı gönderdikten sonra aldığı status linkiyle durumu takip edebilir.

### 4.1. Ne Gösterilir?

- Fatura durumu (Pending, Approved, Ready for Payment, Paid, Rejected)
- Fatura numarası
- Ödeme tarihi (ödendiyse)
- PDF indirme linki (varsa)

### 4.2. Link Kaybedilirse

- **"Enter your email to receive a new link"** alanına e-posta yazılır
- **Send new link** ile yeni status linki istenir
- `/api/guest-invoice-submit/request-status-link` çağrılır

---

## 5. Fatura Listesi ve Onay Süreci

**Yol:** `/invoices`

Guest invoice’lar diğer faturalarla birlikte listede görünür. Özel işaretler:

- **Guest**: Misafir tarafından yüklendi/oluşturuldu
- **Producer**: Producer tarafından oluşturuldu (Mark accepted + Generate invoice)

### 5.1. Onay Akışı

1. **submitted** / **pending_manager**: Manager onayı bekleniyor
2. **rejected**: Reddedildi (gerekçe ile)
3. **approved_by_manager** / **ready_for_payment**: Ödeme aşamasına geçti
4. **paid** / **archived**: Ödendi

Manager faturayı onaylayabilir veya reddedebilir. Reddedilen fatura producer tarafından düzeltilip tekrar gönderilebilir (Resubmit).

---

## 6. Otomatik Hatırlatma (Cron)

**API:** `GET /api/cron/guest-invoice-reminder`

- **Amaç:** Fatura linki gönderilmiş ama 3 gün içinde kullanılmamış misafirlere hatırlatma e-postası
- **Koşul:** Link oluşturulalı 3+ gün geçmiş, hâlâ `used_at` null
- **E-posta:** `sendGuestInvoiceReminderEmail` — link ve kısa hatırlatma metni
- **Zamanlama:** Günlük cron (örn. 10:00 UTC)

---

## 7. Fatura Üretimi (Producer Tarafı)

Producer, **Submit** sayfasından (`/submit`) veya **Invited Guests**’ten **Mark accepted** ile fatura oluşturabilir.

### 7.1. Submit Sayfası

- **Upload**: Producer faturanın PDF/DOCX dosyasını yükler
- **Generate**: Producer fatura formunu doldurur (misafir adı, program, tutar, banka bilgileri vb.)

`/api/invoices/generate` veya `/api/invoices/upload` kullanılır.

### 7.2. Mark Accepted + Generate Invoice

Invited Guests’ta **Mark accepted** modalında "Generate invoice on behalf of guest" işaretlenirse:

- Banka bilgileri (UK veya International) girilir
- Fatura no girilir
- PDF oluşturulup storage’a yüklenir
- Fatura kaydı ve workflow oluşturulur
- Misafire PDF e-postayla gönderilir
- Status linki eklenir

---

## 8. Veri Tabloları

| Tablo | Açıklama |
|-------|----------|
| `producer_guests` | Producer’ın davet ettiği misafirler; accepted, payment_amount, recording_date vb. |
| `guest_invoice_submit_tokens` | Fatura yükleme/oluşturma linkleri; 7 gün geçerli, tek kullanımlık |
| `guest_invitations` | Eski davet kayıtları (guest_invitations) |
| `invoices` | Faturalar; `invoice_type: "guest"` misafir faturaları |
| `invoice_workflows` | Fatura durum geçmişi |

---

## 9. Özet Akış Şeması

```
[Producer] Davet gönder
    ↓
[Guest] Kayda katıl (e-posta ile davet)
    ↓
[Producer] Mark accepted
    ├─ Generate invoice: Fatura oluştur → Misafire gönder
    └─ Link gönder: 7 günlük fatura linki → Misafire gönder
    ↓
[Guest] Linke tıkla → /submit/guest/[token]
    ├─ Upload: PDF/DOCX yükle
    └─ Generate: Form doldur, fatura oluştur
    ↓
[Manager] Faturayı onayla veya reddet
    ↓
[Finance] Ödemeyi yap, "Mark paid"
```

---

## 10. E-posta Türleri

| E-posta | Ne Zaman | Alıcı |
|---------|----------|-------|
| Davet (invite) | Producer davet gönderince | Misafir |
| Post-recording (ödeme + link) | Mark accepted, link gönderilince | Misafir |
| Post-recording (ödeme + fatura) | Mark accepted, fatura üretilince | Misafir |
| Fatura linki | Send link ile | Misafir |
| Hatırlatma | Cron, 3 gün sonra | Misafir |
| Fatura onayı | Guest upload/generate sonrası | Misafir, Producer |
| Durum değişikliği | Manager onayı, ödeme vb. | İlgili roller |

---

## 11. API Uç Noktaları

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/producer-guests/invite-send` | Tek davet gönder |
| `POST /api/producer-guests/bulk-invite-send` | Toplu davet |
| `POST /api/producer-guests/[id]/mark-accepted` | Kabul işareti, isteğe bağlı fatura üretimi |
| `POST /api/guest-invoice-submit/send-link` | Fatura linki gönder |
| `GET /api/guest-invoice-submit/[token]` | Token doğrulama (internal) |
| `POST /api/guest-invoice-submit/upload` | Misafir fatura yükleme |
| `POST /api/guest-invoice-submit/generate` | Misafir fatura oluşturma |
| `GET /api/guest-invoice-submit/status/[token]` | Fatura durumu |
| `POST /api/guest-invoice-submit/request-status-link` | Yeni status linki iste |
| `GET /api/cron/guest-invoice-reminder` | Hatırlatma cron’u |

---

## 12. Önemli Notlar

1. **Link geçerlilik süresi:** 7 gün
2. **Link tek kullanımlık:** Bir kez upload/generate yapıldıktan sonra kullanılamaz
3. **Günlük limit:** Admin hariç, kullanıcı başına 5 fatura linki
4. **Banka tipi:** UK (sort code + account number) veya International (IBAN + SWIFT/BIC)
5. **Invoice type:** Guest faturalar `invoice_type: "guest"` ile işaretlenir
