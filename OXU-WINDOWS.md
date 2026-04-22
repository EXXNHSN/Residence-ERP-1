# Windows-da Quraşdırma Təlimatı

Naxçıvan Residence ERP layihəsini Windows kompüterində lokal şəbəkədə işlətmək üçün addım-addım təlimat.

---

## Tələblər

Aşağıdakı proqramları əvvəlcədən quraşdırın:

| Proqram | Versiya | Yükləmə linki |
|---------|---------|---------------|
| **Node.js** | 18 və ya yuxarı | https://nodejs.org |
| **PostgreSQL** | 16 (məsləhətli) | https://www.postgresql.org/download/windows/ |
| **Git** | son versiya | https://git-scm.com/download/win |

> **PostgreSQL quraşdırma zamanı:** Şifrəni yadda saxlayın (məs: `postgres123`), portu **5432** qoyun, "Stack Builder"-i ləğv edin.

---

## 1. PostgreSQL-də baza yaradın

Start menyusundan **pgAdmin 4** açın → şifrəni daxil edin → sol tərəfdə:

```
Servers → PostgreSQL 16 → Databases → sağ klik → Create → Database
```

Ad: **`naxchivan_erp`** → **Save**

---

## 2. Layihəni endirin

PowerShell və ya CMD açın, istədiyiniz qovluğa keçin və:

```cmd
git clone <REPLIT_GIT_URL> naxchivan-erp
cd naxchivan-erp
```

(Və ya zip kimi yükləyib açın və o qovluğa keçin)

---

## 3. Bir kliklə quraşdır

```cmd
windows-setup.bat
```

Bu skript avtomatik olaraq:
1. Node.js və pnpm-i yoxlayır
2. `.env` fayllarını yaradır
3. Bütün asılılıqları yükləyir (`pnpm install`)
4. Verilənlər bazası cədvəllərini yaradır

---

## 4. ❗ `.env` faylını redaktə edin (vacib!)

`artifacts\api-server\.env` faylını **Notepad** ilə açın və PostgreSQL şifrənizə uyğunlaşdırın:

```env
DATABASE_URL=postgresql://postgres:SİZİN_ŞİFRƏ@localhost:5432/naxchivan_erp
JWT_SECRET=buraya_uzun_bir_sirli_metn_yazin
PORT=8080
```

Sonra **yenidən** `windows-setup.bat` işlədin (cədvəllərin yaranması üçün).

---

## 5. Sistemi işə salın

```cmd
windows-start.bat
```

İki pəncərə açılacaq (API + Web). Brauzerinizdə açın:

**http://localhost:5173**

İlk istifadəçilər avtomatik yaranır:
- **Admin:** `admin` / `admin123`
- **Satış:** `satis` / `satis123`

---

## 6. Lokal şəbəkədə digər kompüterlərdən giriş

`windows-start.bat` işə salındıqda kompüterinizin IP-sini göstərir, məs: `192.168.1.50`.

Eyni şəbəkədəki digər kompüterlərdən brauzerdə açın:

**http://192.168.1.50:5173**

### ⚠ Windows Firewall

İlk dəfə Node.js işə salındıqda Windows soruşacaq:
> "Windows Defender Firewall has blocked some features..."

**"Allow access"** düyməsinə basın (həm Private, həm Public şəbəkə üçün).

---

## Gündəlik istifadə

Hər dəfə kompüteri açanda:

```cmd
windows-start.bat
```

Sistem işləyəndə hər iki pəncərə açıq qalmalıdır. Bağlamaq üçün hər ikisində **Ctrl+C** basın.

---

## Tez-tez verilən suallar

### Port artıq istifadə olunur?
Port 8080 və ya 5173 başqa proqram tərəfindən tutulubsa, `.env` fayllarında dəyişdirin.

### Şifrəmi unutdum?
PostgreSQL şifrəsini **pgAdmin** vasitəsilə bərpa edə bilərsiniz, və ya yenidən PostgreSQL quraşdırın.

### Bazada nə qalıb görmək istəyirəm
**pgAdmin 4** açın → `naxchivan_erp` bazası → Schemas → public → Tables.

### Yeni bir kompleks üçün eyni proqramı işlətmək istəyirəm
PostgreSQL-də yeni baza yaradın (məs: `palace_residence`), `.env`-də ad dəyişin, `windows-setup.bat` təkrar işlədin.
