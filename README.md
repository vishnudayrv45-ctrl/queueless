# QueueLess – Smart Queue Management System

QueueLess lets people get a **digital token**, **track their position** and see an **estimated waiting time**
at government offices and public service centres. Staff manage tokens, counters, services and priorities.

* Backend: **Java 17 + Spring Boot 3** (REST API)
* Database: **H2**, saved in a file (`data/queueless.mv.db`) so nothing is lost when you restart
* Frontend: plain HTML/CSS/JavaScript served by the same Java app, with a **3D queue animation** (no libraries, works offline)
* Intro animation: **SevaGate** – people walk through a queue towards the counter while "QueueLess" appears

## What you need

1. **JDK 17 or newer** (`java -version` should show 17+)
2. **VS Code** with the *Extension Pack for Java* (and optionally *Spring Boot Extension Pack*)
3. **Maven** – only if you want to run from the terminal. Running with the VS Code Run button needs no separate Maven.

## Run it

**Option A – VS Code (easiest)**
1. `File → Open Folder…` and choose the `QueueLess` folder. Wait until Java finishes importing the project (first time downloads libraries, needs internet).
2. Open `src/main/java/com/queueless/QueueLessApplication.java` and click **Run** above `main`.
3. Open <http://localhost:8080>

**Option B – terminal**
```
mvn spring-boot:run
```

## Pages

| Page | URL | Who |
|------|-----|-----|
| Get a token | http://localhost:8080/ | Public |
| Track my token | http://localhost:8080/track.html | Public |
| Live board (for a waiting-hall TV) | http://localhost:8080/board.html | Public |
| Staff desk | http://localhost:8080/admin.html | Staff – login `admin` / `admin123` |
| Database viewer | http://localhost:8080/h2-console | Developer – JDBC URL `jdbc:h2:file:./data/queueless`, user `sa`, empty password |

Change the admin login in `src/main/resources/application.properties` before real use.
On first start the app creates 4 sample services and 5 counters; edit them in the Staff desk.

## How the queue works

* Every service has its own queue. Tokens look like `C-001` and restart every day.
* **Priority:** persons with disability first, then senior citizens, then regular visitors; first-come-first-served inside each group. Staff can change a waiting token's priority after checking an ID.
* **Estimated wait** = people ahead × average service time ÷ open counters. It starts from the average set by the admin and switches to the real average of today's completed tokens after 3 are served.
* Staff press **Call next** on a counter → the best-ranked waiting person is called and the live board updates.
  **Complete** finishes the service, **Skip** marks a no-show.
* A person can cancel their own waiting token (needs the mobile number used).
* **Visitors without a phone:** staff open *Staff desk → Tokens → Issue a walk-in token*. The mobile number is optional there, and a **Print slip** button (or "print automatically") gives the visitor a paper slip with the token number. They watch the live board for their number. Such tokens cannot be tracked or cancelled online. On the public website the mobile number is still required.
* Tokens left unserved from earlier days are closed automatically at start-up and after midnight.

## Project layout

```
QueueLess/
├─ pom.xml                         Maven build (Spring Boot, JPA, H2)
├─ src/main/java/com/queueless/
│  ├─ QueueLessApplication.java    starts the app
│  ├─ model/                       database tables: ServiceCategory, Counter, Token (+ enums)
│  ├─ repository/                  database access (Spring Data JPA)
│  ├─ service/                     QueueService (queue rules), CatalogService, AdminAuthService
│  ├─ controller/                  REST API: PublicController, AdminController
│  ├─ dto/                         request/response objects with validation
│  ├─ config/                      admin login check, sample data, nightly cleanup
│  └─ exception/                   friendly JSON errors
└─ src/main/resources/
   ├─ application.properties       port, database, admin login
   └─ static/                      the website (index, track, board, admin + css + js)
```

## REST API (summary)

Public: `GET /api/services`, `POST /api/tokens`, `GET /api/tokens/{number}`, `POST /api/tokens/{number}/cancel`, `GET /api/board`

Staff (header `X-Admin-Token` from `POST /api/admin/login`): `/api/admin/stats`, `/tokens`, `/counters`, `/services`,
`POST /counters/{id}/call-next`, `POST /tokens/{id}/complete|skip|cancel`, `PUT /tokens/{id}/priority`, plus create/update/delete for counters and services.

## Ideas to extend later

SMS/WhatsApp alerts, appointment booking, multi-office support, charts for peak hours, switching H2 to MySQL/PostgreSQL
(change the datasource lines in `application.properties` and add the driver to `pom.xml`).

---

# Upgrade: WhatsApp notifications + 6 languages

## Run it
Same as before (`mvn spring-boot:run` or the VS Code Run button), then open http://localhost:8080
- **Demo mode is the default**: no WhatsApp account needed. Get a token with the "Send me updates on WhatsApp" box ticked, then click "See the WhatsApp messages (demo)" on the ticket (or open `/whatsapp-demo.html`) to see the simulated messages. Staff see the full history in **Staff → WhatsApp**.
- **Real WhatsApp** (optional): set environment variables before starting, never in code:
  `WHATSAPP_MODE=cloud`, `WHATSAPP_TOKEN=...`, `WHATSAPP_PHONE_NUMBER_ID=...` (optional: `WHATSAPP_API_VERSION`, `WHATSAPP_COUNTRY_CODE`, default 91).
  Meta requires an approved Business account; for production, approved message templates are needed for messages sent outside a 24-hour chat window.
- If any WhatsApp call fails, the token and queue still work; the failure is stored and staff can press **Retry**.

## WhatsApp: how it works
Messages: confirmation (on token issue), turn approaching (3 to 5 people ahead, staff choose), called (includes counter number), delayed/missed, cancelled. Each contains token number, position, people ahead, estimated wait and counter. A unique database rule on (token, event) prevents duplicates. Staff can switch WhatsApp off/on in **Staff → WhatsApp**.

## Languages
English, Hindi, Kannada, Tamil, Telugu, Malayalam. Choose on the homepage or in the menu bar; the choice is saved in the browser and kept on every page. Texts live in `src/main/resources/messages.properties` (English) and `messages_hi / kn / ta / te / ml.properties`. To change a word, edit the line in that file and restart. Service names typed by staff stay as typed; the four sample services and "Counter N" are translated. Switching language never touches the database.
Fonts: Noto Sans (loaded from Google Fonts when online) with system fallbacks. Please have a native speaker review the translations before real use.

## Files
**New (Java):** `notify/` (QueueEvent, WhatsAppClient, DemoWhatsAppClient, CloudWhatsAppClient, NotificationService), `model/` (NotificationLog, NotificationEvent, NotificationStatus, AppSetting), `repository/` (NotificationLogRepository, AppSettingRepository), `service/` (I18nService, SettingsService), `config/AsyncConfig`, `dto/` (NotificationView, DemoMessageView, ConfigView, SettingsView, SettingsRequest).
**Changed (Java):** `Token` (2 new columns: notify_whatsapp, lang; added automatically), `QueueService` (publishes events), `TokenRequest`, `PublicController`, `AdminController`, `CatalogService`, `AdminAuthService`, `AdminAuthInterceptor`, `GlobalExceptionHandler`, `ApiException`, `WebConfig`, other DTOs (message keys only), `application.properties`.
**New (resources):** the six `messages*.properties`, `whatsapp-demo.html`, `js/whatsapp-demo.js`.
**Changed (frontend):** `api.js`, `home.js`, `track.js`, `board.js`, `admin.js`, `scene3d.js`, the four HTML pages, `app.css`.

## Honest note
The frontend was tested in all six languages (desktop and phone width). The Java code could not be compiled in my sandbox (no internet for Maven), so please run it once and tell me any error text.

## 3D "your place in the queue" scene
The small 3D animation on the token ticket and the Track page shows your own person moving forward as the real queue moves (it uses the same `scene3d.js`, in `tracker` mode). Its labels are translated too.
