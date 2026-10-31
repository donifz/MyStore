# Installable MyStore

The user wants a home-screen application icon for MyStore. Add an installable
web manifest and installation help to the seller login and shared workspace.
The installed app opens `/seller`, preserving the existing role-aware routing.
Use the existing green diamond brand, PNG icons (192, 512 and Apple 180 px),
standalone display, root scope and a stable manifest id.

Approaches: browser-only shortcuts need no code but have generic presentation;
a manifest gives MyStore a name, icon and standalone window; a service worker
would add offline/update complexity. Choose the manifest approach for the
requested shortcut. Do not cache API responses, credentials or transactions,
add offline mutations, dependencies, service workers, or automatic reloads.

Native installation is offered only after `beforeinstallprompt`, from an
explicit button click. Retain a captured event across client-side navigation.
Handle cancellation and errors, hide install UI in installed display mode,
and provide browser-menu instructions for Android/desktop and iPhone.
Serve PWA resources through the real production Express boundary as well as
Vite. Do not change public storefront routing or session behavior.

Verify prompt lifecycle, fallback, installed mode, manifest/icons, real HTTP
serving and responsive Playwright flows. Run repository formatting, typecheck,
build, relevant tests and inspect CI before requesting merge.
