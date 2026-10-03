<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/88f2b2c3-a1d3-4908-ba08-662a55a156e6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `GEMINI_API_KEY` in `.env.local` – without it the partners answer with the built-in canned replies
3. Run the app:
   `npm run dev` (starts `server.ts`: Express + Vite on http://localhost:3000)
4. Production: `npm run build && npm start`


## Əlavə olunan / düzəldilən hissələr
- `npm install` xətası düzəldildi (`esbuild` versiyası `vite 8` ilə toqquşurdu).
- `server.ts` + `/api/reply`: Gemini ilə real cavablar (açar yoxdursa / xəta olarsa hazır cavablara qayıdır).
- Hər hesabın öz çatları və mesajları var (əvvəl hamı eyni çatları görürdü); qeydiyyatdan keçən istifadəçilər Explore-da görünür.
- Mövzular (themes) indi həqiqətən görünüşü dəyişir; ərəb dilində RTL.
- "Enter ilə göndər" və "Onlayn statusu göstər" ayarları işləyir; IME (yapon) yazısında Enter səhv göndərmir.
- Mesaj silmə, çat pin/unpin (pin-lənmişlər yuxarıda), çatların sıralanması, oxunmamış sayğacı (stale-closure xətası düzəldildi).
- Mesaj statusları: sent → delivered → read.
- Cihazdan şəkil göndərmə (kiçildilir), səs mesajı (60 san), video zəngdə kamera önizləməsi.
- Mobilədə çat menyusu (hover olmadan) əlçatan oldu; qalan sabit İngilis mətnləri 7 dilə tərcümə edildi.
- Qeydiyyatda yaş < 18 artıq səssizcə 18-ə çevrilmir, xəta göstərilir.

## Hələ də demo səviyyəsindədir
- Giriş/parol localStorage-dadır (real backend və hash yoxdur), mesajlar cihazlar arasında sinxron deyil.
- Zənglər simulyasiyadır (WebRTC yoxdur).
