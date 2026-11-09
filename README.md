# UMT Everyday · version 0.2

> **Personal project · Under active development · Not available for public use**
>
> UMT Everyday is an independent personal project made for its creator's own use. It is a work in progress and is not currently open to other students or the public. It is not an official UMT application or affiliated with the university.

A personal attendance PWA built in React, Vite, GSAP, and Three.js. The eight courses and 16 weekly sessions match the supplied Fall 2026 registration list and portal timetable, including Linear Algebra (MA210, corrected from the earlier M210). Attendance records remain sample data. The app does not connect to a student portal or collect credentials.

## Run locally

Requires Node.js 22.13+ (24 recommended for the full reminder test suite) and pnpm 11.

```sh
pnpm install
pnpm dev
```

## Build and check

```sh
pnpm test
pnpm build
pnpm preview
```

The build creates `dist/`, including an installable manifest, iPhone icons, and a versioned offline service worker. Serve `dist/` over HTTPS to install it on a phone. Localhost also supports offline development. The development server intentionally does not register the production service worker.

## Included

- A compact frosted-glass capsule navigation: the selected tab expands into a white pill, inactive tabs show icons, and the pill and labels animate together. The dock uses a translucent theme tint with backdrop blur, a shorter transition and comfortable touch targets. Keyboard navigation, reduced motion, resizing and interrupted transitions are supported.
- Eight registered courses in a continuous carousel controlled by swipe, wheel, keyboard arrows, or the subject selector. Compact subject names keep a four-row rail readable; course details show the official names and codes. One animated position drives movement, perspective, scale, opacity, depth-of-field blur, and the fading circular track. Drag directly on course names, or use arrow keys and Home/End while focused there.
- Attendance history with Present / Absent filters and target calculations that include future classes in the denominator.
- Schedule opens on Today with this week's Monday–Sunday dates in UMT's Asia/Karachi time zone. The connected timeline shows actual class times and session-specific rooms, sorted chronologically. Both lab sessions are kept separate; Friday's second COAL lab ends at 21:15 as shown in the source. Class highlighting follows campus time, with In progress / Next class for today and First class for future weekdays. Sunday has no classes. Each session opens class details and links to its attendance. Schedule's header is separate from the UMT branding on other screens.
- A configurable attendance target, reduced-motion preferences, install guidance, and settings saved locally.
- Four saved appearance options under Settings → Appearance: Electric (black/yellow), Porcelain (ivory/blue), Burgundy (wine/rose), and Carbon & Copper (warm black/copper), applied across all screens and dialogs. Existing theme identities and saved preferences are preserved.
- A compact, real 3D attendance pass matching the selected concept: rounded graphite body, metal edge, raised yellow check and woven strap. Its material stays the same in every theme.
- Offline startup from the exact built app shell, with all JavaScript (including the 3D module), styles, fonts, icons and artwork saved locally. The real weekly timetable, course/teacher details, sample attendance and saved preferences remain available without a connection. Settings reports Ready offline only after the worker verifies every required cache entry; interrupted saves retry online. App navigation uses the local matching build immediately, including notification links. One previous build is retained for already-open windows. Reminder service requests remain online-only.
- Class reminder setup under Settings, including iPhone install guidance, per-device enrollment, a real test push after activation, and an explicit pending state until the Cloudflare service is connected. See [server/README.md](server/README.md) for deployment and [PHONE_TEST.md](PHONE_TEST.md) for the physical iPhone checks.
- Phone touch refinements: comfortable swipe distance, primary-pointer tracking and interrupted-gesture recovery, larger touch targets, safe-area padding, a viewport that adjusts to Safari/keyboard changes without disabling pinch zoom, and scrollable compact-screen dialogs.

On iPhone, open the deployed app in Safari, choose Share → Add to Home Screen, then open the new icon. The web app uses the phone's actual status bar; it does not draw a fake status bar inside the interface.

## Files

- `src/BottomDock.jsx` and `src/bottomDock.css`: the expanding capsule navigation and motion.
- `src/main.jsx`: screens, navigation, dialogs, and preferences.
- `src/depthCarousel.js`: the animation and gesture controller.
- `src/courseRail.js` and `src/courseRail.css`: the flat, endlessly repeating four-row course selector. Two middle rows stay clear, and the top/bottom rows fade. Touch keeps native momentum; mouse-wheel input uses eased animation and settling. Repeating bands recenter after touch scrolling rests, so there is no blank first/last window. Only the central copy is exposed to assistive navigation.
- `src/Artwork.jsx`: interface icons and schedule illustration.
- `src/passScene.js`: procedural badge model and shared Three.js renderer.
- `src/StudentPass.jsx`: carousel artwork and image fallback.
- `src/schedule.css`: responsive weekly timetable styles matching the approved design.
- `src/themes.js`: appearance options and preference validation.
- `src/data.js`: registered courses, actual weekly timetable, sample attendance records, and attendance calculations.
- `src/scheduleDate.js`: campus date, week navigation, and class highlighting.
- `src/reminderSchedule.js`: reminder timing, expiry, notification text, and safe session links shared with the server.
- `src/NotificationPanel.jsx` and `src/notifications.js`: device enrollment, permission flow, service status, and test/disable controls.
- `src/pushWorker.js`: visible push handling and notification click routing, included in the offline worker build.
- `src/offlineWorker.js` and `src/offline.js`: atomic offline installation, local startup, cache verification/repair and device readiness. The worker does not cache hosting/sign-in responses as the app shell.
- `server/`: deployed Cloudflare notification service, D1 schema, cron configuration, and recovery instructions. Per-device enrollment and notification permission are required for alerts.
- `scripts/build-offline.mjs`: offline-cache generation after Vite builds.

The desktop preview uses a phone-shaped frame. At phone widths, the interface fills the available screen and accounts for safe-area insets.

The focused pass displays directly through one live WebGL canvas at the device's physical pixel ratio. Both the CSS box and drawing buffer resolve to whole physical pixels, including 125% and 150% display scaling. Blurred neighbouring courses use snapshots from the same renderer; the focused pass is never displayed through a rescaled bitmap. Its settled position snaps to the physical pixel grid and is remeasured after route transitions. UMT uses larger solid vector letters with strokes sized for the compact screen. The body has procedural graphite grain, the strap has instanced thread loops, and the raised details cast soft shadows. The Attendance view and its single renderer stay mounted across navigation to avoid repeated model creation and shader compilation. Hidden Attendance content is inert; its carousel and renderer pause until it returns. Motion changes update the existing scene, and resources are disposed when the view unmounts. Focused artwork has no CSS blur filter. Reduced motion fixes the model pose. A high-resolution local image from the same model is shown while loading or if WebGL is unavailable. No remote models, fonts, HDR files or textures are needed, including offline.

Browser checks covered 320×568, 375×667, 390×844, and desktop sizes; touch swipes; intermediate blur and depth states; filters; saved preferences; timetable navigation; and an offline reload. Physical iPhone/Safari timing should be evaluated on the device before calling the animation a final match to the recording.

Class details show the teacher from the supplied course registration/timetable; daily schedule rows remain unchanged. Civics and Linear Algebra have no faculty supplied and display Not provided yet.
